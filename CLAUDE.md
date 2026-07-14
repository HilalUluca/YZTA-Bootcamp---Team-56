# FocusForge — Proje Hafızası ve Devam Notları

> Bu dosya, yeni bir Claude/Cowork sohbetinde ya da takım arkadaşlarımla paylaşmak için hazırlanmış bir "proje hafızası"dır. Yeni bir sohbete başlarken bu dosyayı ilk mesaj olarak ver ki karşındaki her şeyi baştan bilsin.

---

## Ben kimim / durumum
- Bilgisayar mühendisliği mezunuyum ama ilk kez gerçek bir uygulama geliştirme projesinde çalışıyorum. Kod bilgim orta seviye, daha önce böyle takım projesi yapmadım.
- Bir bootcamp'teyim. Takımdaki görevim: **frontend (arayüz) geliştirmek.**
- Windows kullanıyorum. Ortamı yeni kurdum: Git, VS Code, Python, Node.js kurulu.

## Proje nedir? (kısa)
**FocusForge**, yapay zeka destekli bir verimlilik/odaklanma uygulaması. Kullanıcı görevlerini girer, yapay zeka onları önceliklendirir ve koçluk yapar, kullanıcı Pomodoro seansları yapar (25 dk çalış / 5 dk mola), XP/seviye/rozet kazanır. Bootcamp puanlamasında en ağır kriter yapay zeka olduğu için AI projenin merkezinde.

## Teknik yapı (kodun GERÇEK hali — dokümandan farkları var)
> Not: Proje tanıtım dokümanı projenin ilk günlerinde yazıldığı için birebir uymuyor. Aşağısı kodun gerçek durumudur.

- **Frontend:** Ionic + React + Vite + TypeScript. (Doküman "React + Recharts" diyor ama takım **Ionic**'e geçmiş. Recharts henüz yok.)
- Backend'e bağlanmak için **axios** kullanılıyor.
- **Backend:** FastAPI (Python), JWT ile giriş, görev CRUD, AI chat endpoint'i. Swagger dokümantasyonu var (`http://localhost:8000/docs`).
- **Veritabanı:** Şimdilik **SQLite** (`focusforge.db`). (Doküman PostgreSQL + Redis diyor ama henüz o aşamada değiliz.)
- **AI:** Google Gemini API.
- Backend API adresi (frontend'in bağlandığı yer): `http://localhost:8000/api`

## Repo ve branch bilgisi
- GitHub repo: **YZTA-Bootcamp---Team-56** (public).
- Frontend, ana reponun içinde **`frontend/`** klasöründe (takım kararı: aynı repo).
- Frontend kurulumu şu branch'te: **`feature/ionic-frontend-setup`**
- Ben kendi çalışma branch'imi bundan açtım: **`frontend-arayuz`**
- Frontend'i çalıştırma: `cd frontend` → `npm install` → `npm run dev` → `http://localhost:5173`
- Backend'i çalıştırma (ayrı terminal): venv aktifleştir → `python -m uvicorn app.main:app --reload`

## KODUN DURUMU — en önemli kısım
Frontend iki katman: bir kısmı gerçek çalışıyor, bir kısmı sahte ("mock") maket.

**Hazır ve gerçek (dokunmaya gerek yok, sağlam):**
- `src/services/api.ts` → backend'e bağlanan altyapı kurulu. Base URL doğru, giriş yapınca alınan token'ı her isteğe otomatik ekliyor.
- `src/pages/Login.tsx` → giriş/kayıt ekranı gerçekten backend'e bağlı yazılmış (`/auth/login`, `/auth/register` çağrıları var). `onLoginSuccess` adında bir prop bekliyor.

**Sahte (mock) — benim işim bunları gerçeğe bağlamak:**
- `src/pages/Tab1.tsx` (Görevler) → görevler koda elle yazılmış sahte liste. Backend'e bağlı değil.
- `src/pages/Tab2.tsx` (AI Koç) → mesaj yazınca rastgele hazır cevaplar veriyor, gerçek AI'ya gitmiyor.
- `src/pages/Tab3.tsx` (Profil) → "Test User" vb. her şey sahte, elle yazılmış. `onLogout` prop'u alıyor ama `App.tsx`'te sadece `console.log` yapıyor.

**Önemli tespit:** `App.tsx`'te Login **import edilmiş ama routing'e bağlanmamış.** Uygulama açılınca giriş adımını atlayıp direkt Görevler (`/tab1`) sekmesine gidiyor. Yani giriş ekranı var ama "kapıya" takılı değil — bu yüzden `5173`'te uygulama direkt görev listesiyle açılıyor.

## Mevcut ekranlar vs hedef tasarım
- **Şu an var (3 sekme):** Görevler, AI Koç, Profil.
- **Hedef tasarım (dark + light mod verildi):** 5 sekme → Ana Sayfa, Görevler, Odaklan (Pomodoro), Koç, Profil + karanlık modda Analitik ekranı.
- Yani ileride yapılacak yeni ekranlar: **Ana Sayfa, Odaklanma/Pomodoro, Analitik.** Var olanlar da tasarıma göre geliştirilecek. Dark/Light mod için Ionic'in hazır desteği var (`App.tsx` içinde `dark.system.css` zaten import edilmiş).

## Benim görev sıram (Sprint 1 hedefi: giriş + gerçek görev + gerçek AI sohbeti)
1. **Login'i uygulamaya bağla** — uygulama açılınca önce giriş ekranı gelsin, giriş yapınca sekmeler açılsın, "Çıkış Yap" gerçekten çalışsın. (Her şey token istediği için ilk bu yapılmalı.)
2. **Tab1 (Görevler) → gerçek `/api/tasks/`'e bağla** — sahte listeyi kaldır, backend'den çek; ekleme/tamamlama gerçekten kaydedilsin.
3. **Tab2 (AI Koç) → gerçek AI endpoint'ine bağla** — rastgele cevaplar yerine backend'den gerçek yanıt gelsin.

> Sonraki sprintlerde: Odaklanma (Pomodoro) ekranı, Ana Sayfa, Analitik paneli, oyunlaştırma (XP/rozet), dark mode cilası.

## ŞU AN KALDIĞIMIZ YER (bir sonraki adım)
**Sıradaki iş: 1. adım — `App.tsx`'i düzenleyip Login'i uygulamaya "auth kapısı" olarak bağlamak.** Giriş yapılmadıysa Login ekranı, yapıldıysa sekmeler görünecek; çıkış yapınca token silinip tekrar Login'e dönülecek. Henüz bu koda başlamadık; bir sonraki adım bu.

## Jargon sözlüğü (kendim için)
- **Endpoint:** backend'in bir kapısı/adresi (örn. `/api/tasks/`).
- **CRUD:** Create/Read/Update/Delete = ekle/oku/güncelle/sil.
- **Mock:** sahte/maket veri. Gerçekmiş gibi görünen uydurma.
- **Token:** giriş yapınca alınan "geçiş kartı"; kilitli endpoint'lere bununla girilir.
- **State:** bir ekranın/bileşenin hafızası (React).
- **Props:** bir bileşene dışarıdan verilen bilgi (React).
- **Branch:** projenin sana ait çalışma kopyası; ana kodu bozmadan çalışırsın.

## Takıma iletilecek not (güvenlik)
Repo public ve içinde **`.env` dosyası yüklenmiş** görünüyor. İçinde gerçek Gemini API anahtarı varsa herkes görebileceği için riskli. Backend'deki arkadaşa "`.env`'i repodan kaldıralım mı?" diye sorulmalı.
