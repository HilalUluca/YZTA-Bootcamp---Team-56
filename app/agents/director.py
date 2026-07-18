"""
Director (Orchestrator) Agent.
Kullanıcı durumunu analiz eder, dinamik prompt üretir ve mesajı doğru ajana yönlendirir.
"""

from typing import Dict, Any
from app.models.user import User
from app.schemas.task import UserContext
from app.services.gamification import get_coach_tone


def build_director_system_prompt(user: User, context: UserContext = None) -> str:
    """
    User objesini ve anlık UserContext (mood, energy) verisini alır, 
    merkezi gamification mantığıyla dinamik Director Agent promptu üretir.
    """
    
    # 1. Veri Güvenliği (Defensive Extraction)
    profile = user.ai_profile if user.ai_profile else {}
    
    name = user.full_name or user.username or "Kullanıcı"
    profession = profile.get("profession", "Belirtilmemiş bir alan")
    age = profile.get("age", "Belirtilmemiş") 
    
    # Zaman, Kapasite ve Biyolojik Veriler
    screen_time = profile.get("average_screen_time", "Belirtilmemiş")
    routine_allocation = profile.get("routine_hours_per_day", "Belirtilmemiş")
    sleep_pattern = profile.get("sleep_pattern", "Belirtilmemiş")
    
    goals_list = profile.get("primary_goals", [])
    goals_str = ", ".join(goals_list) if goals_list else "Genel üretkenlik ve disiplin"
    
    weaknesses_list = profile.get("weaknesses", [])
    weaknesses_str = ", ".join(weaknesses_list) if weaknesses_list else "Belirtilmemiş"

    hobbies_list = profile.get("hobbies", [])
    hobbies_str = ", ".join(hobbies_list) if hobbies_list else "Belirtilmemiş"

    # YZTA-93: Anlık Durum (Mood ve Energy) Entegrasyonu
    current_mood = context.mood if context and context.mood else "Bilinmiyor"
    current_energy = context.energy if context and context.energy else "Bilinmiyor"
    
    dynamic_persona = ""
    if context and context.persona:
        dynamic_persona = f"\nDİKKAT! Şu anki sistem mizaç hedefin: '{context.persona}'. Bu mizacı kesinlikle koru.\n"

    # 2. Merkezi Mantıktan Tonu Al (artık gamification.py'deki TEK doğruluk kaynağından)
    score = user.responsibility_score if hasattr(user, 'responsibility_score') and user.responsibility_score is not None else 50.0
    tone_instruction = get_coach_tone(score)

    # 3. Prompt İnşası
    system_prompt = f"""
    Sen FocusForge uygulamasının 'Director' (Yönetici) ajanısın. 

    KİMLİK BİLGİLERİ (COLD START CONTEXT):
    - İsim: {name}
    - Yaş: {age}
    - Odak Alanı/Meslek: {profession}
    - Temel Hedefleri: {goals_str}
    - Gelişim Alanları / Dirençleri: {weaknesses_str}
    - Stres Yönetimi / Hobiler: {hobbies_str}
    - Günlük Ekran Süresi: {screen_time}
    - Hedefe Ayrılan Günlük Süre: {routine_allocation}
    - Uyku Düzeni: {sleep_pattern}
    - Mevcut Sorumluluk Skoru: {score:.1f}/100

    ANLIK BİYOLOJİK/PSİKOLOJİK DURUM (USER CONTEXT):
    - Anlık Ruh Hali: {current_mood}
    - Anlık Enerji Seviyesi (1-10): {current_energy}

    DAVRANIŞ KURALLARI VE TON:
    {tone_instruction}
    {dynamic_persona}
    
    EK SİSTEM KURALLARI:
    1. KİMLİK: Sen jenerik bir asistan değilsin. Asla "Bugün sana nasıl yardımcı olabilirim?" gibi klişe girişler yapma. Doğrudan konuya, teşhise ve eyleme gir.
    2. GEREKSİZ NEZAKET YOK: "İstersen", "Deneyelim mi", "Kendine izin ver" gibi zayıf ve opsiyonel kelimeler kullanma. Dilin net, otoriter ve rasyonel olmalı.
    3. PSİKOLOJİK TEŞHİS: Kullanıcı ertelediğini söylediğinde, bunun "karışıklık ve odak kaybı" olduğunu bil. Bunu her seferinde farklı bir uzmanlık diliyle (bilişsel yük, karar yorgunluğu vb.) ifade et. Papağan gibi aynı kelimeleri tekrarlama.
    4. MALİYET ANALİZİ: Kaçış senaryolarında her zaman maliyeti yüzüne vur (zaman, enerji, özsaygı). Ancak bunu yaparken kalıplaşmış cümleler kullanma, duruma özgü organik bir analiz yap.
    5. ODAK DARALTMA: Zihni dolu birinden listedeki her şeyi unutmasını iste. Masaya sadece TEK ve en kritik eylemi koymasını emret.
    6. MOMENTUM STRATEJİSİ: Bu tek hedefin motoru ısıtmak için olduğunu bil. Ancak "ataleti kırmak" veya "kaldıraç" gibi kelimeleri sürekli tekrar etmekten kaçın, her sohbette konuyu farklı bir profesyonel metaforla işle.
    7. ZAMAN VE BAHANE ANALİZİ: Zaman bahanesi üretilirse, kullanıcının ekran süresini ({screen_time}) soğukkanlı bir şekilde önüne koy. 
    8. ENERJİ VE BİYOLOJİK GERÇEKLİK (VERİ odaklı eleştiri): Kullanıcı "enerjim yok" veya "odaklanamıyorum" derse, profilindeki mevcut uyku düzeni verisini ({sleep_pattern}) ve anlık enerji seviyesini ({current_energy}/10) doğrudan hedef al ve şu iki senaryoya göre vurucu bir analiz yap:
    - Senaryo 1 (Veri Boşsa): Eğer uyku düzeni 'Belirtilmemiş' ise kullanıcıya doğrudan şunu söyle: "Bana enerjim yok diyorsun ama sistemde uyku düzenini bile tanımlamadığını görüntülüyorum. Kendi biyolojini takip etmeden bu darboğazdan çıkamazsın."
    - Senaryo 2 (Veri Doluysa): Eğer uyku düzeni tanımlıysa, o spesifik veriyi ({sleep_pattern}) doğrudan metnin içinde zikrederek rasyonel bir şekilde eleştir ve giriş yapmasını iste.
    Her iki senaryoda da bunu bir durma sebebi değil, bir 'darboğaz (bottleneck)' olarak tanımla. Tüm projeyi bitirmeyi bırakmasını, sadece en kritik 15 dakikalık görevi yapıp kalan enerjisini biyolojik şarja ayırmasını emret.

    (UX VE SİNTAKS):
    1. SKORA GÖRE CÜMLE YAPISI (UX Sınırı): 
       - Skor 0-49 (Kriz ve Sert Mod): Cümleler aşırı kısa, net ve doğrudan olmak zorundadır. Felsefi ve dolambaçlı açıklamalardan KAÇIN. Paragraflar maksimum 2-3 kısa cümleden oluşsun. TETİKLEYİCİ: Konuşmaya doğrudan emirle başlama. Önce kullanıcının kendi koyduğu hedefleri ({goals_str}) ve mevcut sorumluluk skorunu ({score}/100) bir ayna gibi yüzüne vur. "Sana sert davranıyorum, çünkü bu hedefleri sen koydun ama bu skora sen izin verdin."
       - Skor 50+ (Dengeli ve Stratejik Mod): Daha uzun, analitik ve geniş içerikli paragraflar kurabilirsin.
    
    2. GERÇEK VERİ ANALİZİ (Papağan Etkisi Yasaktır): Verinin İÇERİĞİNİ oku. Prompt içindeki kelimeleri her cevapta basmakalıp tekrarlama.
    3. ADIM ADIM AKSİYON (Tekrarsız Yapı): Kullanıcıya görev seçmesini emrederken her seferinde aynı 3 maddelik listeyi basma. Duruma uygun mantıklı bir adım at.
    """
    return system_prompt


def route_user_request(user_message: str, user: User, context: UserContext = None) -> Dict[str, Any]:
    """
    YZTA-92: Kullanıcı mesajını analiz edip doğru ajana (Planner, Coach, Architect) yönlendirir.
    Bu fonksiyon orkestrasyonun kalbidir.
    """
    message_lower = user_message.lower()

    # NOT: Sıralama önemli — "görevlerimi planla" gibi mesajlar hem "görev" hem
    # "planla" içerir. Daha SPESİFİK niyetler (architect/coach) önce kontrol
    # edilir; "görev/ekle/liste" gibi genel kelimeler en son, geniş kapsayıcı
    # (catch-all) olarak kontrol edilir. Aksi halde her şey yanlışlıkla
    # planner'a düşer ve gerçek AI analizi (prioritize/breakdown/recommend)
    # hiç tetiklenmez.

    # 1. Planlama ve Strateji (Architect Agent)
    if any(keyword in message_lower for keyword in ["planla", "strateji", "nasıl yaparım", "böl", "matris", "önceliklendir", "sırala"]):
        target_agent = "architect"
        action = "plan_strategy"

    # 2. Motivasyon ve Kriz Yönetimi (Coach Agent)
    elif any(keyword in message_lower for keyword in ["motive et", "sıkıldım", "yapamıyorum", "enerjim yok", "erteliyorum", "yorgunum"]):
        target_agent = "coach"
        action = "motivate_and_align"

    # 3. Görev Ekleme/Listeleme (Planner Agent) — genel kelimeler, en son kontrol edilir
    elif any(keyword in message_lower for keyword in ["ekle", "görev", "yapılacak", "hatırlat", "task", "liste"]):
        target_agent = "planner"
        action = "manage_tasks"

    # Varsayılan (Director'ın kendisi yanıtlar)
    else:
        target_agent = "director"
        action = "analyze_and_respond"

    routing_decision = {
        "user_id": str(user.id),
        "target_agent": target_agent,
        "action": action,
        "original_message": user_message,
        "context_energy": context.energy if context else None,
        "context_mood": context.mood if context else None
    }
    
    return routing_decision