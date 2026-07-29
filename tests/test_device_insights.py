"""
Cihaz kullanım analizinin birim testleri — YZTA-151.

Buradaki fonksiyonlar saf (veritabanı ve LLM gerektirmez); asıl korumak
istediğimiz şey `wasted_slots` matematiği: hangi saatin boşa gittiği ve
kaç dakika olduğu yanlış hesaplanırsa kullanıcıya güvenilmez bir sayı
gösteririz.
"""

from types import SimpleNamespace

import pytest

from app.services import device_insights as di


# --- Uygulama sınıflandırması -------------------------------------------------

def test_dikkat_dagitici_uygulamalar_tanınır():
    assert di.is_distracting("instagram")
    assert di.is_distracting("TikTok")      # büyük/küçük harf fark etmez
    assert di.is_distracting("  YouTube ")  # boşluklar kırpılır


def test_notr_uygulamalar_israf_sayilmaz():
    # Chrome/VS Code bağlama göre üretken olabilir; kullanıcıyı bunlarla suçlamayız.
    assert not di.is_distracting("chrome")
    assert not di.is_distracting("vscode")
    assert not di.is_distracting("")


def test_gosterim_adlari():
    assert di.display_app("youtube") == "YouTube"
    assert di.display_app("x") == "X (Twitter)"
    assert di.display_app("bilinmeyenapp") == "Bilinmeyenapp"


# --- Saat profili -------------------------------------------------------------

def _entry(hourly):
    """Sadece hourly_usage'ı olan sahte bir DeviceUsage satırı."""
    return SimpleNamespace(hourly_usage=hourly, sleep_hours=0, step_count=0)


def test_profil_gunlere_bolunur():
    # Aynı saat iki günde 40'ar dakika → ortalama 40 olmalı, toplam 80 değil.
    entries = [
        _entry({"14": {"youtube": 40}}),
        _entry({"14": {"youtube": 40}}),
    ]
    totals, per_app, days = di._hourly_distraction_profile(entries)
    assert days == 2
    assert totals[14] == 40.0
    assert per_app[14]["youtube"] == 40.0


def test_veri_olmayan_gunler_ortalamayi_bozmaz():
    # hourly_usage'ı boş olan gün "veri yok" sayılır, bölene katılmaz.
    entries = [_entry({"14": {"youtube": 60}}), _entry({})]
    totals, _, days = di._hourly_distraction_profile(entries)
    assert days == 1
    assert totals[14] == 60.0


def test_notr_uygulama_profile_girmez():
    entries = [_entry({"10": {"chrome": 50, "instagram": 20}})]
    totals, per_app, _ = di._hourly_distraction_profile(entries)
    assert totals[10] == 20.0
    assert "chrome" not in per_app[10]


def test_bos_giris_listesi():
    assert di._hourly_distraction_profile([]) == ({}, {}, 0)


# --- Boşa giden zaman dilimleri ----------------------------------------------

def test_bitisik_saatler_tek_bloga_birlesir():
    """
    Ticket'taki örnek: 14. saatte 55 dk, 15. saatte 35 dk → 14:00-15:30, 90 dk.
    Blok başlangıcı ilk saatin başı, bitiş = başlangıç + toplam süre.
    """
    totals = {14: 55.0, 15: 35.0}
    per_app = {14: {"youtube": 55.0}, 15: {"tiktok": 35.0}}

    slots = di.find_wasted_slots(totals, per_app)

    assert len(slots) == 1
    assert slots[0]["time"] == "14:00-15:30"
    assert slots[0]["duration_min"] == 90
    assert slots[0]["start_hour"] == 14


def test_bitisik_olmayan_saatler_ayri_blok():
    totals = {14: 50.0, 20: 45.0}
    per_app = {14: {"youtube": 50.0}, 20: {"twitter": 45.0}}

    slots = di.find_wasted_slots(totals, per_app)

    assert len(slots) == 2
    # En uzun blok başa gelir
    assert slots[0]["duration_min"] == 50
    assert slots[1]["duration_min"] == 45


def test_esik_altindaki_saat_israf_sayilmaz():
    # 10 dakikalık bir mola israf değildir.
    totals = {14: float(di.WASTED_HOUR_THRESHOLD_MIN - 1), 15: 10.0}
    per_app = {14: {"youtube": 29.0}, 15: {"tiktok": 10.0}}

    assert di.find_wasted_slots(totals, per_app) == []


def test_esik_tam_degerinde_sayilir():
    totals = {14: float(di.WASTED_HOUR_THRESHOLD_MIN)}
    per_app = {14: {"youtube": float(di.WASTED_HOUR_THRESHOLD_MIN)}}

    slots = di.find_wasted_slots(totals, per_app)
    assert len(slots) == 1


def test_uygulamalar_sureye_gore_siralanir():
    totals = {14: 50.0}
    per_app = {14: {"instagram": 10.0, "tiktok": 30.0, "youtube": 10.0}}

    slots = di.find_wasted_slots(totals, per_app)
    assert slots[0]["apps"][0] == "TikTok"


def test_gece_yarisini_asan_blok_kirpilir():
    # 23:00'te 50 dk → bitiş 23:50; taşma olursa 24:00'ta durmalı.
    totals = {23: 70.0}
    per_app = {23: {"twitter": 70.0}}

    slots = di.find_wasted_slots(totals, per_app)
    assert slots[0]["time"] == "23:00-24:00"


def test_veri_yoksa_slot_yok():
    assert di.find_wasted_slots({}, {}) == []


# --- Saat biçimlendirme -------------------------------------------------------

@pytest.mark.parametrize(
    "minutes,expected",
    [(0, "00:00"), (90, "01:30"), (14 * 60, "14:00"), (23 * 60 + 59, "23:59")],
)
def test_saat_bicimi(minutes, expected):
    assert di._format_clock(minutes) == expected


# --- Öneriler -----------------------------------------------------------------

def test_slot_yoksa_yine_de_oneri_doner():
    # Boş liste dönmek arayüzde boşluk yaratır; nötr bir cümle veriyoruz.
    recs = di.build_rule_recommendations([], [])
    assert len(recs) == 1
    assert "zaman kaybı görünmüyor" in recs[0]


def test_oneri_slot_bilgisini_icerir():
    slots = [{"time": "14:00-15:30", "apps": ["YouTube"], "duration_min": 90, "start_hour": 14}]
    recs = di.build_rule_recommendations(slots, [])
    assert any("14:00-15:30" in r and "90" in r for r in recs)


def test_gec_saat_slotu_uyku_onerisi_ekler():
    slots = [{"time": "21:00-22:00", "apps": ["X (Twitter)"], "duration_min": 60, "start_hour": 21}]
    recs = di.build_rule_recommendations(slots, [])
    assert any("uyku" in r for r in recs)


def test_dusuk_uyku_uyarisi():
    entries = [SimpleNamespace(sleep_hours=5.5, step_count=0) for _ in range(3)]
    recs = di.build_rule_recommendations([], entries)
    assert any("Ortalama uykun" in r for r in recs)


def test_yeterli_uyku_uyari_uretmez():
    entries = [SimpleNamespace(sleep_hours=8.0, step_count=0) for _ in range(3)]
    recs = di.build_rule_recommendations([], entries)
    assert not any("Ortalama uykun" in r for r in recs)


# --- Takvim çakışması ---------------------------------------------------------

def test_takvim_saatleri_dolu_isaretlenir():
    entry = SimpleNamespace(
        calendar_events=[{"title": "Ders", "start": "13:00", "end": "15:30"}]
    )
    assert di._busy_hours(entry) == {13, 14, 15}


def test_tam_saatte_biten_etkinlik_o_saati_kapatmaz():
    # 10:00'da biten toplantı 10. saati işgal etmez.
    entry = SimpleNamespace(
        calendar_events=[{"title": "Toplanti", "start": "09:00", "end": "10:00"}]
    )
    assert di._busy_hours(entry) == {9}


def test_bozuk_takvim_kaydi_cokmez():
    entry = SimpleNamespace(
        calendar_events=[{"title": "Bozuk", "start": "abc", "end": None}, "hatali-kayit"]
    )
    assert di._busy_hours(entry) == set()


def test_kayit_yoksa_bos_kume():
    assert di._busy_hours(None) == set()


# --- LLM yanıtının ayrıştırılması ---------------------------------------------
#
# Gemini bazen düz JSON, bazen ``` bloğuna sarılmış, bazen de önüne açıklama
# yazarak döner. Bu ayrıştırıcı bozulursa öneriler sessizce kural tabanlı
# yedeğe düşer — hata görünmez, kalite düşer. O yüzden test ediliyor.

from app.agents import device_insight_agent as agent  # noqa: E402


def test_duz_json_listesi_ayristirilir():
    assert agent._parse_list('["birinci", "ikinci"]') == ["birinci", "ikinci"]


def test_kod_blogu_icindeki_json_ayristirilir():
    text = '```json\n["birinci", "ikinci"]\n```'
    assert agent._parse_list(text) == ["birinci", "ikinci"]


def test_aciklama_ile_gelen_json_ayristirilir():
    text = 'İşte öneriler:\n["birinci", "ikinci"]\nUmarım yardımcı olur.'
    assert agent._parse_list(text) == ["birinci", "ikinci"]


def test_bos_ogeler_atilir():
    assert agent._parse_list('["birinci", "  ", "ikinci"]') == ["birinci", "ikinci"]


def test_cok_az_oneri_reddedilir():
    # Tek öneri kullanıcıya değer katmaz; yedeğe düşmek daha iyi.
    with pytest.raises(ValueError):
        agent._parse_list('["tek oneri"]')


def test_fazla_oneri_kirpilir():
    text = '["1", "2", "3", "4", "5", "6", "7"]'
    assert len(agent._parse_list(text)) == agent.MAX_RECOMMENDATIONS


def test_liste_olmayan_json_reddedilir():
    with pytest.raises(ValueError):
        agent._parse_list('{"oneri": "tek"}')
