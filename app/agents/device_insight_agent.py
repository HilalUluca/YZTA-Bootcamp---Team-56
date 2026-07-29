"""
Cihaz içgörüleri için LLM katmanı — YZTA-151.

Bu agent SAYI ÜRETMEZ. Boşa giden saatler, süreler ve geri kazanılabilir zaman
`app/services/device_insights.py` içinde veriden hesaplanır; buraya hazır gelir.
LLM'in tek işi bu bulguları kullanıcıya dokunan, somut Türkçe cümlelere
çevirmek.

Neden böyle: LLM'e "kaç dakika kaybetmiş?" diye sormak, doğrulanabilir bir
ölçümü tahmine çevirir. Üslup ise LLM'in gerçekten iyi olduğu iş.

Hata durumunda (API key yok, kota, timeout) çağıran taraf kural tabanlı
cümlelere düşer; bu yüzden buradaki istisnalar yutulmaz, yukarı bırakılır.
"""

import json
import logging
from typing import List

from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import Settings

logger = logging.getLogger(__name__)

# LLM'den beklenen öneri sayısı sınırları — bir liste değil de deneme yazısı
# dönerse ayıklarken işe yarar.
MIN_RECOMMENDATIONS = 2
MAX_RECOMMENDATIONS = 5


def _get_llm():
    """Gemini istemcisi. API key yoksa ValueError."""
    settings = Settings()
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY ayarlanmamış")

    return ChatGoogleGenerativeAI(
        model="gemini-flash-latest",
        google_api_key=settings.gemini_api_key,
        temperature=0.6,
        convert_system_message_to_human=True,
    )


def _extract_text(response) -> str:
    """
    LLM yanıtından düz metni çıkarır. Bazı Gemini modelleri content'i blok
    listesi olarak döndürür (bkz. ai_planner_agent içindeki aynı sorun).
    """
    content = getattr(response, "content", response)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content)


def _parse_list(text: str) -> List[str]:
    """
    Yanıttan string listesi çıkarır. Model bazen JSON'u ``` bloğuna sarar,
    bazen düz liste yazar; ikisini de kabul ediyoruz.
    """
    candidate = text.strip()
    if "```" in candidate:
        # ```json ... ``` veya ``` ... ```
        segments = candidate.split("```")
        for segment in segments:
            cleaned = segment.strip()
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
            if cleaned.startswith("["):
                candidate = cleaned
                break
    else:
        start, end = candidate.find("["), candidate.rfind("]")
        if start != -1 and end > start:
            candidate = candidate[start : end + 1]

    data = json.loads(candidate)
    if not isinstance(data, list):
        raise ValueError("LLM çıktısı liste değil")

    items = [str(item).strip() for item in data if str(item).strip()]
    if len(items) < MIN_RECOMMENDATIONS:
        raise ValueError(f"LLM {len(items)} öneri döndürdü, en az {MIN_RECOMMENDATIONS} bekleniyor")
    return items[:MAX_RECOMMENDATIONS]


_PROMPT = PromptTemplate.from_template(
    """Sen bir kişisel verimlilik koçusun. Aşağıdaki ÖLÇÜLMÜŞ bulgular bir
kullanıcının telefon kullanım verisinden çıkarıldı.

BOŞA GİDEN ZAMAN DİLİMLERİ:
{slots_text}

GÜNLÜK ORTALAMA KAYIP: {daily_wasted} dakika
HAFTALIK GERİ KAZANILABİLİR: {recoverable} saat
DİĞER SİNYALLER: {signals}

Bu bulgulara dayanarak {min_count}-{max_count} arası öneri yaz.

Kurallar:
- Türkçe yaz, kullanıcıya "sen" diye hitap et.
- Her öneri tek cümle, en fazla 20 kelime, somut bir eylem içersin.
- SADECE yukarıdaki sayıları kullan; yeni sayı UYDURMA.
- Suçlayıcı değil, yapıcı ol.
- Çıktı yalnızca JSON string dizisi olsun: ["öneri 1", "öneri 2"]
Başka hiçbir şey yazma."""
)


async def enrich_recommendations(insights: dict, signals: str = "") -> List[str]:
    """
    Kural tabanlı bulguları LLM ile daha iyi cümlelere çevirir.

    Args:
        insights: `device_insights.build_insights()` çıktısı.
        signals: Uyku/adım gibi ek bağlam (serbest metin).

    Returns:
        Öneri cümleleri.

    Raises:
        Herhangi bir hata (key yok, parse, ağ) — çağıran taraf yedeğe düşmeli.
    """
    slots = insights.get("wasted_slots", [])
    if not slots:
        raise ValueError("Boşa giden zaman dilimi yok, LLM'e sormaya gerek yok")

    slots_text = "\n".join(
        f"- {s['time']}: {', '.join(s['apps'][:3])} ({s['duration_min']} dk)"
        for s in slots
    )

    prompt = _PROMPT.format(
        slots_text=slots_text,
        daily_wasted=insights.get("daily_wasted_minutes_avg", 0),
        recoverable=insights.get("recoverable_hours_weekly", 0),
        signals=signals or "ek sinyal yok",
        min_count=MIN_RECOMMENDATIONS,
        max_count=MAX_RECOMMENDATIONS,
    )

    llm = _get_llm()
    response = await llm.ainvoke(prompt)
    return _parse_list(_extract_text(response))
