"""
Cold-start profil mekanizması (YZTA-27).

Yeni bir kullanıcının henüz sohbet, görev veya yansıma verisi yoktur; bu yüzden
davranışa dayalı `ai_profiler_service.generate_ai_profile` fonksiyonu ilk gün
anlamlı bir profil üretemez. Bu servis, onboarding formunda toplanan cevaplardan
(YZTA-71) ilk `UserProfileData` profilini **deterministik** olarak üretir.

Neden LLM kullanmıyoruz:
  - Onboarding cevapları zaten yapılandırılmış; çıkarım (inference) gerekmiyor,
    yalnızca eşleme gerekiyor.
  - Gemini API anahtarı olmadan da (ör. local geliştirme) çalışması gerekiyor.
  - Kayıt akışında hızlı ve maliyetsiz olmalı.

Kullanıcı zamanla veri biriktirdikçe `generate_ai_profile` bu cold-start profilini
davranışsal sinyallerle zenginleştirir/günceller.
"""

from datetime import datetime, timezone
from typing import Any, Optional

from app.schemas.profile import Goals, UserProfileData


def _clean_list(value: Any) -> list[str]:
    """Bir alanı temizlenmiş string listesine çevirir (None/boş elemanları atar)."""
    if not value:
        return []
    if isinstance(value, str):
        value = [value]
    return [str(item).strip() for item in value if str(item).strip()]


def _clean_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def build_cold_start_profile(onboarding: dict) -> UserProfileData:
    """
    Onboarding cevaplarından ilk (cold-start) kullanıcı profilini üretir.

    Args:
        onboarding: OnboardingData.model_dump() çıktısı (ham cevaplar).

    Returns:
        Doğrudan `ai_profile["user_profile"]` altına yazılabilecek UserProfileData.
    """
    age = onboarding.get("age")
    profession = _clean_str(onboarding.get("profession"))
    about_me = _clean_str(onboarding.get("about_me"))
    personality = _clean_str(onboarding.get("personality"))
    communication_style = _clean_str(onboarding.get("communication_style"))
    sleep_pattern = _clean_str(onboarding.get("sleep_pattern"))
    screen_time = _clean_str(onboarding.get("average_screen_time"))
    routine_hours = _clean_str(onboarding.get("routine_hours_per_day"))
    biggest_challenge = _clean_str(onboarding.get("biggest_challenge"))
    preferred_technique = _clean_str(onboarding.get("preferred_technique"))

    primary_goals = _clean_list(onboarding.get("primary_goals"))
    daily_goals = _clean_list(onboarding.get("daily_goals"))
    hobbies = _clean_list(onboarding.get("hobbies"))
    weaknesses = _clean_list(onboarding.get("weaknesses"))

    # --- Kişilik / çalışma özellikleri (traits) ---
    traits: list[str] = []
    if personality:
        traits.append(personality)
    if profession:
        traits.append(f"Odak alanı: {profession}")
    if age:
        traits.append(f"{age} yaşında")
    if preferred_technique and preferred_technique.lower() != "none":
        traits.append(f"Tercih ettiği teknik: {preferred_technique}")

    # --- Çalışma düzeni (work_patterns) ---
    work_bits: list[str] = []
    if sleep_pattern:
        work_bits.append(f"Uyku: {sleep_pattern}")
    if routine_hours:
        work_bits.append(f"Hedeflerine ayırdığı süre: {routine_hours}")
    if screen_time:
        work_bits.append(f"Günlük ekran süresi: {screen_time}")
    work_patterns = " · ".join(work_bits) if work_bits else "Henüz gözlemlenmiş bir çalışma düzeni yok (onboarding'e dayalı)."

    # --- Risk sinyalleri ---
    risk_signals = list(weaknesses)
    if biggest_challenge:
        challenge_map = {
            "procrastination": "Erteleme eğilimi",
            "focus": "Odaklanma güçlüğü",
            "prioritization": "Önceliklendirme zorluğu",
            "motivation": "Motivasyon dalgalanması",
        }
        risk_signals.append(challenge_map.get(biggest_challenge.lower(), biggest_challenge))

    # --- Koçluk tercihleri ---
    coaching_bits: list[str] = []
    if communication_style:
        coaching_bits.append(f"'{communication_style}' üslubundan hoşlanıyor")
    if preferred_technique and preferred_technique.lower() != "none":
        coaching_bits.append(f"{preferred_technique} tekniğiyle çalışmayı tercih ediyor")
    coaching_preferences = (
        ". ".join(coaching_bits) + "."
        if coaching_bits
        else "Üslup tercihi henüz belirtilmedi; nötr ve destekleyici bir ton kullan."
    )

    # --- Kişiselleştirme ipuçları ---
    hints: list[str] = []
    if about_me:
        hints.append(f"Kendini şöyle tanımlıyor: {about_me}")
    if hobbies:
        hints.append(f"Mola/dopamin reset için hobiler: {', '.join(hobbies)}")
    if communication_style:
        hints.append(f"Mesajlarını '{communication_style}' üslubuna göre ayarla.")
    if not hints:
        hints.append("Kullanıcıyı tanımak için ilk günlerde nazikçe sorular sor.")

    # --- Güven (confidence): doldurulan çekirdek alan oranına göre ---
    core_fields = [
        bool(primary_goals),
        bool(daily_goals),
        bool(about_me),
        bool(personality),
        bool(communication_style),
        bool(hobbies),
        bool(sleep_pattern),
    ]
    filled_ratio = sum(core_fields) / len(core_fields)
    if filled_ratio == 0:
        confidence = "unknown"
    elif filled_ratio >= 0.66:
        confidence = "high"
    elif filled_ratio >= 0.33:
        confidence = "medium"
    else:
        confidence = "low"

    now = datetime.now(timezone.utc)
    filled_count = sum(core_fields)

    return UserProfileData(
        profile_version="1.0",
        generated_at=now.isoformat(),
        confidence=confidence,
        traits=traits,
        goals=Goals(short_term=daily_goals, long_term=primary_goals),
        work_patterns=work_patterns,
        risk_signals=risk_signals,
        coaching_preferences=coaching_preferences,
        personalization_hints=hints,
        evidence=f"Onboarding formu (cold-start, {filled_count}/{len(core_fields)} çekirdek alan dolu, LLM kullanılmadı).",
        last_updated_from_range=f"onboarding @ {now.strftime('%Y-%m-%d')}",
    )
