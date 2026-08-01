# FocusForge — Proje Durumu ve Kalan Görev Planı

> Bu dosya Asya'nın (frontend geliştirici) çalışma hafızasıdır. Yeni bir Code/Cowork oturumunda bunu ilk olarak oku. "ŞU AN KALDIĞIM YER" başlığından devam et. Asya yeni başlayan biri — her adımı sade dille anlat, önce ne yapılacağını açıkla sonra kodu yaz, tahmin etme her zaman backend şemalarına bak.

---

## Proje özeti
FocusForge: AI destekli verimlilik/odaklanma uygulaması. Görev yönetimi + Pomodoro + AI koç + oyunlaştırma. Bootcamp projesi, Takım 56.

## Teknik yapı
- **Frontend:** Ionic + React + Vite + TypeScript (Asya'nın alanı)
- **Backend:** FastAPI (Python), SQLite (`focusforge.db`), Google Gemini. Ayrı takım üyeleri yazıyor.
- Backend API adresi: `http://localhost:8000/api` — Swagger: `http://localhost:8000/docs`
- Frontend çalıştırma: `cd frontend` → `npm run dev` → `http://localhost:5173`
- Backend çalıştırma (kök dizinde, ayrı terminal): venv aktif → `python -m uvicorn app.main:app --reload`
- `src/services/api.ts` zaten kurulu, token'ı otomatik ekliyor — her ekran bunu kullanır.

## Repo / branch
- Repo: `YZTA-Bootcamp---Team-56` (frontend, ana reponun `frontend/` klasöründe)
- Asya'nın çalışma branch'i: **`frontend-arayuz`**
- Commit mesajlarına Jira task ID eklenmeli: örn. `YZTA-47: ...`
- `.Codex/`, `AGENTS.md`, `focusforge.db` `.gitignore`'da (repoya gönderilmez)

---

## BİTEN İŞLER ✅ (dokunma, çalışıyor)
- **Login** — auth kapısı (App.tsx), giriş/çıkış akışı, papağan tasarımı
- **Görevler (Tab1)** — `/api/tasks/` gerçek bağlantı: listele/ekle/tamamla/geri al/sil
- **AI Koç (Tab2)** — `/api/chat/` gerçek sohbet + `/chat/history` geçmiş. Mock yok, doğrulandı.
- **Pomodoro (Focus)** — `/api/focus/` seans başlat/bitir, hazır süreler (15/25/45/50) + özel süre, yıldız değerlendirme
- **Ana Sayfa (Home/Dashboard)** — `/api/stats/dashboard` gerçek veri, kartlar, seviye çubuğu
- **Profil (Tab3)** — `/api/auth/me` gerçek kullanıcı, XP hedefi 500'e çekildi (backend formülüyle tutarlı)
- Tüm ekranlar açık/koyu tema uyumlu.
- Jira'da tamamlandı yapıldı: YZTA-45, YZTA-30, YZTA-24, YZTA-48, YZTA-98, YZTA-13

## BİLİNEN BACKEND SORUNU (Asya'nın işi değil)
- AI Koç: backend `gemini-2.5-flash` modeli kullanıyor, bu model yeni API key'lere kapalı (500 hatası). Frontend doğru; backend'de model adı güncellenmeli. Gruba iletildi. (Arkadaşın eski key verirse çalışabilir.)
- `custom` Pomodoro süresi backend'de `planned_duration` olarak saklanmıyor (şema var, router kullanmıyor). Özellik onsuz çalışıyor. Detay: `backend-iyilestirme-notlari.txt`

---

## ŞU AN KALDIĞIM YER
Sprint 2 kapandı. İkinci PR açıldı (yansıma, günlük plan, Eisenhower, kart rozetleri, tsconfig fix).
Kalan işler: YZTA-99 (görev detay + AI parçalama), YZTA-100 (onboarding wizard), 
habit ekranları (YZTA-105/106/107/111/112) → Sprint 3.
---

## KALAN FRONTEND GÖREVLERİ (öncelik sırasıyla)
Hepsinin backend'i hazır (Swagger'da mevcut). Sırayla git, nereye kadar yetişirsen o; yetişmeyen Sprint 3'e.

### Grup 1 — Hızlı kazanımlar
1. **YZTA-47** Responsive kontrol — tüm ekranları mobilde gez, bozuklukları düzelt. Yeni ekran değil. Demo-kritik.
2. **YZTA-49** AI "yazıyor..." animasyonu — Tab2'de zaten "Forge düşünüyor..." var, rötuş.
3. **YZTA-51** Forge maskotu chat'te profil resmi — chat'te AI mesajlarının yanına papağan avatar.

### Grup 2 — Tek ekranlık orta işler
4. **YZTA-32** Günlük yansıma formu — modal: ruh hali (emoji), enerji slider (1-5), "bugün ne iyi gitti / yarın ne değişir". → `POST /api/reflections/`
5. **YZTA-97** Günlük plan görünümü — "Bugünün Planı" modal/sayfa → `POST /api/planner/daily-plan`, sıralı görev + tahmini süre
6. **YZTA-46 + YZTA-25 + YZTA-99** Görev detay + öncelik etiketleri (tek pakette yap) — görev kartında öncelik/deadline göster, tıklayınca detay: düzenle, öncelik değiştir, parçala → `/api/tasks/break-down`

### Grup 3 — Zor / büyük işler
7. **YZTA-96** Eisenhower matrisi — 4 kadran (Acil+Önemli / Önemli / Acil / Düşük) → `POST /api/tasks/prioritize`
8. **YZTA-100** Onboarding wizard — ilk giriş sonrası 3 adım: hedefler, çalışma saatleri, en büyük zorluk → `POST /api/auth/onboarding`

### Grup 4 — Habit ekranları (en sona, en riskli)
9. **YZTA-105** Onboarding'e habit adımı ekle
10. **YZTA-106** Günlük check-in UI → `POST /api/habits/check-in`, `GET /api/habits/today`
11. **YZTA-107** Habit istatistik görünümü (ısı haritası, streak) → `GET /api/habits/stats`
12. **YZTA-111** Editable checklist component
13. **YZTA-112** "Listeye ekle" butonu

---

## ÇALIŞMA KURALLARI (Asya'nın öğrendikleri)
- Her iş bitince: kendi ekranında test et (backend + giriş açık olmalı) → `git add ...` → `git commit -m "YZTA-XX: ..."` → `git push origin frontend-arayuz`
- Commit ≠ push. Push'layınca açık PR otomatik güncellenir.
- Yeni endpoint kullanırken Swagger'daki şemaya bak, alan adlarını tahmin etme.
- Merge çakışmasında `focusforge.db` çıkarsa: `git checkout -- focusforge.db` (test verisi, önemsiz).
- Terminal klasörü: `npm` komutları `frontend/` içinde, `python/uvicorn` kök dizinde.
- Bir iş bitince bu dosyadaki "ŞU AN KALDIĞIM YER" bölümünü güncelle.
