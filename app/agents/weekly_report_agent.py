import os
import json
import logging
import time
from typing import Dict, Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from pydantic import ValidationError

from app.schemas.report import ReportContent

logger = logging.getLogger(__name__)

# LLM Initialization
def get_report_llm():
    return ChatGoogleGenerativeAI(
        model="gemini-flash-latest",
        google_api_key=os.getenv("GEMINI_API_KEY") or "dummy_key_for_tests",
        temperature=0.2, # Düşük temperature, daha rasyonel ve deterministik çıktılar için
        max_retries=3
    )

SYSTEM_PROMPT = """
Sen uzman bir Veri Analisti ve aynı zamanda empati yeteneği yüksek bir Verimlilik Koçusun.
Sana kullanıcının son 7 günlük uygulama kullanım istatistikleri (Görevler, Odaklanma, Ruh Hali, Alışkanlıklar) JSON formatında verilecek.
Görevin bu verileri analiz ederek anlamlı, aksiyon odaklı ve tutarlı bir haftalık özet rapor üretmek.

KURALLAR (KESİNLİKLE UYULACAK):
1. Çıktı tamamen yapısal formata uygun ve Türkçe olmalıdır.
2. Sadece verilen metriklerden konuş. Elinde olmayan bir veri hakkında yorum yapma.
3. Eksik veya "0" olan veriler için halüsinasyon (uydurma) yapma, verinin eksik/yetersiz olduğunu belirt.
4. Çıkarımların kesin değilse 'tahmin' veya 'görünüyor' gibi ifadelerle etiketle.
5. Kullanıcıya sen diliyle hitap et. Motive edici ama abartısız bir ton kullan.
"""

def generate_weekly_report_content(metrics: Dict[str, Any]) -> ReportContent:
    """
    LLM kullanarak toplanan metriklerden haftalık AI raporunu oluşturur.
    Timeout/Retry ve Fallback mekanizmaları içerir.
    """
    llm = get_report_llm()
    structured_llm = llm.with_structured_output(ReportContent)
    
    prompt_template = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", "Haftalık Metrikler (JSON):\n{metrics_json}\nLütfen haftalık değerlendirme raporunu oluştur.")
    ])
    
    chain = prompt_template | structured_llm
    
    metrics_str = json.dumps(metrics, indent=2, ensure_ascii=False)
    
    start_time = time.time()
    try:
        # LLM'e istek atılır
        report: ReportContent = chain.invoke({"metrics_json": metrics_str})
        
        # Ek model meta verisi için loglama (latency vs endpoint'te hesaplanacak)
        logger.info(f"Report generated successfully in {time.time() - start_time:.2f} seconds.")
        return report
        
    except ValidationError as ve:
        logger.error(f"Structured output validation failed: {ve}")
        return _get_fallback_report(reason="Çıktı doğrulama hatası")
    except Exception as e:
        logger.error(f"Weekly report generation failed: {e}")
        return _get_fallback_report(reason="Yapay zeka servisi şu an yanıt veremiyor")

def _get_fallback_report(reason: str) -> ReportContent:
    """Yapay zeka çökmesi/timeout durumunda güvenli dönüş (Fallback)."""
    return ReportContent(
        summary=f"Haftalık rapor şu an oluşturulamadı. (Hata: {reason})",
        insights=["Mevcut analiz edilebilecek yeterli model verisi alınamadı."],
        risks=[],
        actions=["Lütfen verilerini loglamaya devam et, daha sonra tekrar dene."],
        motivation="Veriler güvende, sadece analiz motoru kısa bir mola verdi!",
        confidence={"level": "low", "reason": "Sistem hatası nedeniyle varsayılan (fallback) değerler dönüldü."}
    )
