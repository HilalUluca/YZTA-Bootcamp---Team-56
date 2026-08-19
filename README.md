# FocusForge

<p align="center">
  <img src="Project%20Management/Daily%20Scrum/newbanner2.jpeg" alt="FocusForge Corporate Header" width="100%" />
</p>

---

<p align="center">
  <b>Language Selection / Dil Seçimi</b>
</p>

<details>
<summary><b>🇬🇧 Click to read in English</b></summary>

## 👥 Team Members (Team 56)

<table>
  <tr>
    <th>👤 Member</th>
    <th>🎯 Scrum Role</th>
    <th>💻 Technical Focus / Responsibility</th>
  </tr>
  <tr>
    <td><b>Hilal Uluca</b></td>
    <td>Scrum Master</td>
    <td>AI</td>
  </tr>
  <tr>
    <td><b>Furkan Türker</b></td>
    <td>Product Owner</td>
    <td>Backend</td>
  </tr>
  <tr>
    <td><b>Doğukan Kaya</b></td>
    <td>Developer</td>
    <td>AI</td>
  </tr>
  <tr>
    <td><b>Asya Aynur Gers</b></td>
    <td>Developer</td>
    <td>Frontend</td>
  </tr>
  <tr>
    <td><b>Mete Ülken</b></td>
    <td>Developer</td>
    <td>Backend</td>
  </tr>
</table>

---

## 🚀 Project Vision & Architecture

> *"The sustainability of human focus..."*

**FocusForge** is a proactive and autonomous life architecture designed for remote professionals, indie developers, and individuals striving to build daily discipline. Traditional To-Do apps passively list tasks and amplify guilt. FocusForge is not just a list-management tool; it is a **Rational Strategy Partner (Director Agent)** that semantically unifies a user's digital footprint, sleep patterns, screen time, and real-time emotional state.

The system analyzes discrepancies between a user's biological capacity and target workload, autonomously uncovers the root causes of procrastination (comfort-zone escapes), and breaks down large goals into micro-steps (Tool Calling) that avoid mental overload. It doesn't blame; it holds up a rational mirror: *"This inertia mathematically pulls you this far from your goal; now break the comfort zone."*

---

## 🏛️ Core Architectural Features

* **Character & Personal Development Focus:** Targets mental resilience, boundary-setting skills, life management, and self-esteem rather than just task completion. Offers rational confrontations backed by compassionate authority instead of fake motivation.
* **Dual-Track Database Architecture:** Strictly separates tasks (`Must-Do`) and continuous lifestyle habits (`Habit` - e.g., hydration, hygiene) at the database level.
* **Mood & Habit Tracker:** Tracks daily mood, energy levels, and target habits to communicate based on biological readiness. Correlates these metrics with a "Responsibility Score" to build a semantic productivity matrix.
* **Dynamic Onboarding & Deep Profiling:** Captures baseline data, hobbies, growth targets, and long-term life goals. The AI utilizes this not as static records, but as a living context shaping communication style and long-term vision.
* **Annual Goal & Life Direction Integration:** Bridges daily tasks with grand life directions. The AI cross-examines every micro-step or procrastination event with the user's annual vision.
* **End-of-Day Summary & Rational Confrontation Engine:** Autonomously generates daily wrap-ups by analyzing tasks, energy, mood, screen time, and sleep.
* **Smart Daily Planning & Energy-Based Prioritization:** Restructures daily plans based on current energy and available time blocks when cognitive bottlenecks occur, optimizing focus hours.
* **Productivity Score & Risk Signals:** Quantifies autopilot behaviors through advanced profiling to detect burnout risks (`warnings`) and flag them in daily summaries.
* **Daily Reflection:** Generates strategic introspection questions targeting comfort-zone escapes without shaming.
* **Rational Confrontation Against Victim Mentality:** Avoids toxic positivity; semantically analyzes biometric data (sleep/screen time) to expose bottlenecks and present mathematical costs of inaction.
* **Responsibility Score & Integrity Check (Gamification):** Computes a dynamic 0-100 Responsibility Score by tracking delayed tasks, broken promises, and completed habits, blocking self-deception by cross-referencing digital footprints.
* **Holistic Data Access & Semantic Analysis:** The Director Agent reads chat history, completion rates, energy reflections, sleep, and screen time in a unified ecosystem to deliver root-cause coaching.

---

## 🗺️ Three-Phase Expansion Roadmap

### Phase 1: B2C Individual Assistant MVP (Current Stage)
* **Hybrid UI & Agentic Flow:** Core setup where the Director (AI) chats with the user, breaks down tasks via `break_down_task` tool, and injects interactive UI checklist widgets directly into the chat.
* **Daily Mood & Habit Tracking:** Integration of the `Habit` module to log daily energy, hydration, sleep, and mood metrics into the database.
* **LLM-Powered Prioritization:** Background LLM analysis of task pools for automated Eisenhower matrix classification and tone modulation based on responsibility scores.

### Phase 2: Sensor & Health/OS Integrations (Proactive Intervention)
* **Contextual Data Stream:** API integrations with mobile devices or smartwatches (Apple Health / Google Fit / OS Screen Time) to track sleep duration and biological recovery.
* **Autonomous Planning & Real-Time Optimization:** Moving simulated Phase 1 scheduling into real algorithmic backend integration, optimizing tasks dynamically based on biological rhythms.
* **Autonomous Triggers:** Generating proactive notifications when screen time crosses critical thresholds or sleep drops below 4 hours, alongside stress-relief break suggestions.
* **Action-Taking AI (Native OS & Actions):** Upgrading Phase 1 mock permission interfaces to native mobile/OS APIs for setting alarms, adding calendar events, enabling Do Not Disturb (DND), and voice commands.
* **Menstrual Cycle & Hormonal Rhythm Module:** Integrating hormonal shifts and cyclical energy fluctuations to autonomously optimize sprint workloads according to biological reality.
* **Energy Leak Detector:** Cross-reading mood/energy inputs with task types to detect energy drains (e.g., *"Whenever you start X-type tasks, your energy drops by 50%"*) and suggest delegation.

### Phase 3: B2B Enterprise Integration & FocusForge Team
* **FocusForge Team Module:** Specialized layer uniting corporate and startup teams under "FocusForge Team".
* **Quiet Quitting Shield:** Workload and burnout analytics via Jira and Slack API integrations for engineering teams.
* **Early Warning Dashboard:** Anonymous semantic reports for managers mapping workload distribution and individual burnout indicators to champion sustainable productivity over pressure.

---

## 🔌 API Endpoint Architecture

<details>
<summary><b>🔐 Auth & User Management</b></summary>

- `POST /api/auth/register` : Register new user
- `POST /api/auth/login` : User login (JWT Token)
- `GET /api/auth/me` : Get current user details
- `PATCH /api/auth/profile` : Update AI user profile (Onboarding)
</details>

<details>
<summary><b>📋 Tasks, Habits & Planning</b></summary>

- `GET /api/tasks/` : List tasks
- `POST /api/tasks/` : Create new task
- `PUT /api/tasks/{task_id}` : Update task
- `DELETE /api/tasks/{task_id}` : Delete task
- `POST /api/planner/daily-plan` : Generate AI daily plan
- `POST /api/planner/bulk-create` : Bulk task creation (post-breakdown)
</details>

<details>
<summary><b>⚡ Focus, Reflection & Score</b></summary>

- `POST /api/focus/start` & `end` : Focus sessions
- `POST /api/reflections/` : Daily reflection (mood, energy, sleep) log
- `GET /api/stats/dashboard` : Dashboard summary (Streak, Tasks, Cost Report)
- `GET /api/score` : Responsibility score & risk signals
- `POST /api/achievements/check` : Achievement & badge verification
</details>

<details>
<summary><b>🤖 AI Chat (Director & Coach) & Profiling</b></summary>

- `POST /api/chat/` - LangChain-based AI chat with Summary Buffer Memory for long-term context & token efficiency.
- `GET /api/chat/history` - Historical chat logs.
- `POST /api/profile/generate` - Updates permanent AI profile by analyzing chat, tasks, and reflections.
- `GET /api/profile/` - Fetches user's AI Profile.
</details>

---

## 🤖 AI Architecture

<details>
<summary><b>🤖 AI Agent Orchestration</b></summary>
  
| Agent | Name | Role | Personality |
|---|---|---|---|
| Orchestrator | Director | Routes messages, manages responsibility score | Invisible, background runner |
| Coach | Forge | Motivation, advice, questioning, task breakdown | Goal-oriented yet empathetic |
| Planner | Architect | Prioritization, daily plan, deadline management | Rational, strategic |
| Analyst | Sage | Productivity analysis, pattern detection, weekly reports | Calm, non-judgmental |
</details>

---

## 🎯 Target Audience

1. **Individuals Facing Focus Issues:** Those seeking to break procrastination loops, transform lifestyle habits, and build personal discipline.
2. **Working Professionals & Developers:** Independent developers, data scientists, and freelancers tackling time management, sleep disruption, and focus fragmentation.
3. **Corporate Teams (Phase 3 Goal):** Tech companies and HR departments aiming to boost efficiency, manage capacity, and prevent burnout.

---

## 🔗 Product Backlog & Management

👉 **[FocusForge Miro Sprint Board & Burndown Chart](https://miro.com/welcomeonboard/U3BtZmFtcDgzYm1GdmlXUlUrZDNDU08vSFhwYmpZd01VcnlXeCtrRmhkQVZQSG5xbkxKeHZJaEkrd2d6WHNKVms5b01PVzVlR1JFRlN0a3VHYnNFOEtyd0wwMlhKTU0rSjhuUjRlUjhSVUlVQW9PckRwemF4M0dtK1hhZFFQaWlNakdSWkpBejJWRjJhFnhhb1UwcS9BPT0hdjE=?share_link_id=809806536559)**

</details>

<details>
<summary><b>🇹🇷 Türkçe okumak için tıklayın</b></summary>

## 👥 Takım Üyeleri (Takım 56)

<table>
  <tr>
    <th>👤 Üye</th>
    <th>🎯 Scrum Rolü</th>
    <th>💻 Teknik Odak / Sorumluluk</th>
  </tr>
  <tr>
    <td><b>Hilal Uluca</b></td>
    <td>Scrum Master</td>
    <td>AI</td>
  </tr>
  <tr>
    <td><b>Furkan Türker</b></td>
    <td>Product Owner</td>
    <td>Backend</td>
  </tr>
  <tr>
    <td><b>Doğukan Kaya</b></td>
    <td>Developer</td>
    <td>AI</td>
  </tr>
  <tr>
    <td><b>Asya Aynur Gers</b></td>
    <td>Developer</td>
    <td>Frontend</td>
  </tr>
  <tr>
    <td><b>Mete Ülken</b></td>
    <td>Developer</td>
    <td>Backend</td>
  </tr>
</table>

---

## 🚀 Proje Vizyonu & Mimari

> *"İnsanın sürdürülebilirliği..."*

**FocusForge;** uzaktan çalışan profesyoneller, indie geliştiriciler ve disiplin inşa etmeye çalışan bireyler için tasarlanmış **proaktif ve otonom bir yaşam mimarisidir.** Geleneksel "To-Do" uygulamaları, kullanıcının girdiği görevleri pasif bir şekilde listeler ve suçluluk duygusunu besler. FocusForge ise bir liste yönetimi aracı değil; kullanıcının dijital ayak izini, uyku düzenini, ekran süresini ve anlık duygu durumunu **semantik olarak birleştiren Rasyonel bir Strateji Ortağıdır (Director Agent).** 

Sistem; kullanıcının biyolojik kapasitesi ile hedeflenen iş yükü arasındaki uyumsuzlukları analiz eder, erteleme davranışlarının altındaki kök sebepleri otonom olarak çözer ve büyük hedefleri zihinsel yük yaratmayacak mikro adımlara (Tool Calling) böler. "Neden yapmadın?" diye suçlamaz; *"Bu eylemsizlik seni hedefinden matematiksel olarak şu kadar saptırıyor, şimdi konfor alanını kır"* diyerek rasyonel bir ayna tutar.

---

## 🏛️ Temel Mimari Özellikler

* **Karakter ve İnsan Gelişimi Odaklı Yaklaşım:** Sistem sadece "iş bitirmeyi" değil, bireyin zihinsel dayanıklılığını, sınır çizebilme becerisini, hayatını yönetebilmeyi ve öz-saygısını artırmayı hedefler. Sahte motivasyon yerine şefkatli otoriteyle rasyonel yüzleşmeler sunar.
* **Dual-Track (Çift Yönlü) Veritabanı Mimarisi:** Görevler (`Must-Do`) ve sürekli yaşam alışkanlıkları (`Habit` - su içmek, diş fırçalamak vb.) veritabanı seviyesinde birbirinden ayrılır. 
* **Mood & Habit Tracker:** Sistem, her gün kullanıcının modunu, enerji seviyesini ve geliştirmek istediği alışkanlıklarını takip eder. Böylece kullanıcının biyolojik yeterliliği de baz alınarak iletişim kurulur.
* **Dinamik Onboarding ve Derin Profilleme:** Sistem, başlangıçta kullanıcıdan temel verilerini, hobilerini, geliştirmek istediği yönleri ve yıllık yaşam hedeflerini alır. Yapay zeka bu verileri statik bir veritabanı kaydı olarak değil; kullanıcının iletişim dilini ve vizyonunu şekillendiren canlı bir bağlam olarak kullanır.
* **Yıllık Hedef ve Yaşam Yönü Entegrasyonu:** Günlük hedefler ile kullanıcının büyük yaşam hedefleri arasındaki köprü kurularak çapraz sorgulama yapılır.
* **Gün Sonu Özeti & Rasyonel Yüzleşme Motoru:** Sistem, her günün sonunda kullanıcının verilerini analiz ederek otonom bir "Gün Sonu Özeti" üretir.
* **Akıllı Günlük Planlama & Enerji Bazlı Önceliklendirme:** Kullanıcının anlık enerji seviyesine ve ayırabileceği zamana göre günün planını yeniden yapılandırır.
* **Verimlilik Skoru & Risk Sinyalleri:** Otopilot davranışlarını matematiksel olarak puanlar, tükenmişlik risklerini önden raporlar.
* **Günün Sorgulaması (Reflection):** Konfor alanı kaçışlarını yüzüne vuran stratejik iç gözlem soruları üretir.
* **Kurban Psikolojisine Karşı Rasyonel Yüzleşme:** Sahte motivasyon yerine biometrik verileri semantik olarak analiz ederek darboğazları çözer.
* **Sorumluluk Skoru & Integrity Check (Gamification):** Geciken görevler ve tamamlanan alışkanlıklar dinamik bir algoritmaya tabi tutularak matematiksel bir "Sorumluluk Skoru" (0-100) üretir.
* **Bütüncül Veri Erişimi ve Semantik Analiz:** AI asistanı; sohbet geçmişini, görev tamamlama oranlarını, mod/enerji yansımalarını, uyku düzenini ve ekran süresini tek ekosistemde okur.

---

## 🗺️ Üç Aşamalı Genişleme Stratejisi (Roadmap)

### Faz 1: B2C Bireysel Asistan MVP (Mevcut Aşama)
* **Hibrit UI ve Agentic Akış:** Director ile sohbet edip `break_down_task` aracıyla büyük işleri parçalayıp chatin içine onaylanabilir interaktif UI Widget'ları (Checklist Kartları) gönderme altyapısı.
* **Günlük Mod ve Alışkanlık Takibi:** Günlük enerji, su içme, uyku ve mod girişlerini veritabanına işleyen `Habit` modülü.
* **LLM Destekli Önceliklendirme:** Görev havuzunun arka planda LLM ile analiz edilip otomatik Eisenhower sınıflandırmasına tabi tutulması.

### Faz 2: Sensör ve Sağlık/İşletim Sistemi Entegrasyonları (Proaktif Müdahale)
* **Bağlamsal Veri Akışı:** Apple Health / Google Fit / OS Screen Time API'lerinin sisteme entegrasyonu.
* **Otonom Planlama ve Gerçek Zamanlı Optimizasyon:** Görevleri biyolojik ritme göre dinamik olarak yeniden önceliklendiren akıllı zaman planlayıcı.
* **Otonom Tetikleyiciler:** Ekran süresi eşiği aşıldığında veya uyku 4 saatin altına düştüğünde bildirimler üretilmesi.
* **Eyleme Geçen AI (Native OS & Action-Taking):** Alarm kurma, takvime etkinlik ekleme, DND moduna alma gibi yeteneklerin native API'lerle gerçeğe dönüştürülmesi.
* **Adet Döngüsü ve Hormonal Ritim Modülü:** Döngüsel enerji dalgalanmalarını sisteme entegre eden akıllı uyum mekanizması.
* **Enerji Sızıntısı Tespiti (Energy Leak Detector):** Hangi görev türlerinde enerjinin düştüğünü tespit ederek optimizasyon önerme.

### Faz 3: B2B Kurumsal Entegrasyon & FocusForge Team
* **FocusForge Team Modülü:** Kurumsal ve startup ekipleri için özel katman.
* **Sessiz İstifa Kalkanı:** Jira ve Slack API entegrasyonları ile iş yükü ve tükenmişlik analizi.
* **Erken Uyarı Dashboard'u:** Yöneticilere anonimleştirilmiş semantik veri raporları sunulması.

---

## 🔌 API Endpoint Mimarisi

<details>
<summary><b>🔐 Auth & Kullanıcı Yönetimi</b></summary>

- `POST /api/auth/register` : Yeni kullanıcı kaydı
- `POST /api/auth/login` : Kullanıcı girişi (JWT Token)
- `GET /api/auth/me` : Mevcut kullanıcı bilgilerini getir
- `PATCH /api/auth/profile` : Kullanıcı AI profilini güncelle (Onboarding)
</details>

<details>
<summary><b>📋 Görev, Alışkanlık & Planlama</b></summary>

- `GET /api/tasks/` : Görevleri listele
- `POST /api/tasks/` : Yeni görev ekle
- `PUT /api/tasks/{task_id}` : Görev güncelle
- `DELETE /api/tasks/{task_id}` : Görev sil
- `POST /api/planner/daily-plan` : AI ile günlük plan oluştur
- `POST /api/planner/bulk-create` : Toplu görev oluşturma (parçalama sonrası)
</details>

<details>
<summary><b>⚡ Odaklanma, Yansıma & Skor</b></summary>

- `POST /api/focus/start` & `end` : Odaklanma seansları
- `POST /api/reflections/` : Günlük yansıma (mod, enerji, uyku) kaydı
- `GET /api/stats/dashboard` : Dashboard özet verileri (Streak, Görevler, Maliyet Raporu)
- `GET /api/score` : Sorumluluk skoru ve risk sinyalleri
- `POST /api/achievements/check` : Başarım ve rozet kontrolü
</details>

<details>
<summary><b>🤖 AI Sohbet (Director & Coach) & Profiling</b></summary>

- `POST /api/chat/` - LangChain tabanlı yapay zeka ile sohbet (Summary Buffer Memory ile uzun süreli bağlam).
- `GET /api/chat/history` - Geçmiş sohbet kayıtları.
- `POST /api/profile/generate` - Kalıcı AI Profilini günceller.
- `GET /api/profile/` - Kullanıcının AI Profilini getirir.
</details>

---

## 🤖 AI Mimarisi

<details>
<summary><b>🤖 AI Agent Orkestrasyonu</b></summary>
  
| Ajan | İsim | Görev | Kişilik |
|---|---|---|---|
| Orkestratör | Director | Mesajı doğru ajana yönlendirir, sorumluluk skorunu yönetir | Görünmez, arka planda çalışır |
| Koç | Forge | Motivasyon, tavsiye, sorgulama, görev parçalama | Hedef odaklı ama empatik |
| Planlayıcı | Architect | Önceliklendirme, günlük plan, deadline yönetimi | Rasyonel, stratejik |
| Analist | Sage | Verimlilik analizi, pattern tespiti, haftalık rapor | Sakin, yargılamayan |
</details>

---

## 🎯 Hedef Kitle

1. **Odak Problemi Yaşayan Bireyler:** Erteleme döngüsünden çıkmak isteyenler.
2. **Çalışan Profesyoneller & Developerlar:** Zaman yönetimi ve odak bölünmesi yaşayanlar.
3. **Kurumsal Takımlar (Faz 3 Hedefi):** Tükenmişliği önlemeyi amaçlayan şirketler.

---

## 🔗 Product Backlog & Yönetim

👉 **[FocusForge Miro Sprint Board & Burndown Chart](https://miro.com/welcomeonboard/U3BtZmFtcDgzYm1GdmlXUlUrZDNDU08vSFhwYmpZd01VcnlXeCtrRmhkQVZQSG5xbkxKeHZJaEkrd2d6WHNKVms5b01PVzVlR1JFRlN0a3VHYnNFOEtyd0wwMlhKTU0rSjhuUjRlUjhSVUlVQW9PckRwemF4M0dtK1hhZFFQaWlNakdSWkpBejJWRjJhFnhhb1UwcS9BPT0hdjE=?share_link_id=809806536559)**

</details>

---

<p align="center">
  <img src="Project%20Management/Daily%20Scrum/GitHub_banner_geometric_shapes_t..._202607300354.jpeg" alt="FocusForge Corporate Header" width="100%" />
</p> 

<p align="center">
  <b>Team 56 @2026 — FocusForge.</b>
</p>
