# FocusForge Projesi Kurulum ve Çalıştırma Kılavuzu

Bu kılavuz, FocusForge projesinin hem **Backend (FastAPI)** hem de **Frontend (Ionic React)** sunucularını bilgisayarınızda nasıl kuracağınızı ve ayağa kaldıracağınızı adım adım açıklamaktadır.

---

## 🛠️ Sistem Gereksinimleri
Başlamadan önce bilgisayarınızda aşağıdaki araçların yüklü olduğundan emin olun:
*   **Python:** 3.10 veya üzeri sürüm ([İndir](https://www.python.org/downloads/))
*   **Node.js:** 18.x veya üzeri sürüm ([İndir](https://nodejs.org/))
*   **Git**

---

## 🔌 1. Backend (FastAPI) Kurulumu

Backend sunucusu, veritabanı işlemlerini, kullanıcı doğrulamasını ve yapay zeka (Gemini API) koçluk servislerini yönetir.

### Adım 1: Sanal Ortam Oluşturma ve Aktifleştirme
Terminali projenin ana dizininde (`YZTA-Bootcamp---Team-56` klasöründe) açın.

*   **Windows (PowerShell):**
    ```powershell
    python -m venv venv
    .\venv\Scripts\Activate
    ```
*   **macOS / Linux:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

### Adım 2: Bağımlılıkların Yüklenmesi
Sanal ortam aktifken gerekli kütüphaneleri yükleyin:
```bash
pip install -r requirements.txt
```

### Adım 3: Çevresel Değişkenlerin Yapılandırılması
Kök dizindeki `.env` dosyasını açarak `GEMINI_API_KEY` değerine kendi API anahtarınızı girin:
```env
GEMINI_API_KEY=AIzaSy... (Gemini API Anahtarınız)
```

### Adım 4: Sunucuyu Çalıştırma
Aşağıdaki komutla FastAPI sunucusunu başlatın:
```bash
uvicorn app.main:app --reload
```
*   Sunucu varsayılan olarak **`http://127.0.0.1:8000`** adresinde çalışmaya başlayacaktır.
*   API dökümantasyonunu test etmek için tarayıcıdan **`http://127.0.0.1:8000/docs`** adresine gidebilirsiniz.

---

## 📱 2. Frontend (Ionic React) Kurulumu

Frontend uygulaması, kullanıcının etkileşime gireceği mobil odaklı kullanıcı arayüzünü (UI) sunar.

### Adım 1: `frontend` Klasörüne Geçiş
Projenin ana dizininden `frontend` alt klasörüne geçin:
```bash
cd frontend
```

### Adım 2: Paket Bağımlılıklarının Yüklenmesi
Gerekli node paketlerini yükleyin:
```bash
npm install
```

### Adım 3: Geliştirme Sunucusunu Çalıştırma
Arayüzü test etmek üzere yerel sunucuyu başlatın:
```bash
npm run dev
```
*   Uygulama varsayılan olarak **`http://localhost:5173/`** adresinde açılacaktır.

---

## 📱 3. Mobil Arayüz Olarak Görüntüleme

Uygulama mobil odaklı tasarlandığından, tarayıcıda test ederken mobil görünümü aktifleştirmeniz gerekir:

1. Tarayıcınızda **`http://localhost:5173/`** adresine gidin.
2. Klavyenizden **`F12`** tuşuna basarak Geliştirici Araçları'nı (DevTools) açın.
3. Paneldeki **Telefon ve Tablet simgesine** tıklayarak **Cihaz Modu'nu** aktifleştirin (Kısayol: `Ctrl + Shift + M`).
4. Üst menüden bir telefon modeli (Örn: *iPhone 14 Pro*) seçin ve sayfayı **`F5`** ile yenileyin.

---

## 💡 Mock (Çevrimdışı/Simüle) Modu Hakkında Not
Şu anda frontend uygulaması, backend sunucusuna veya veritabanına bağlı kalmadan doğrudan test edilebilmesi amacıyla **statik prototip modunda** çalışmaktadır. 
*   **Görevler:** Yerel tarayıcı hafızasında simüle edilir.
*   **AI Koç:** Yapay zeka yanıtları yerel bir simülatör üzerinden gecikmeli olarak üretilir.
*   **Giriş Sayfası:** Login sistemi bypass edilerek doğrudan ana ekrana yönlendirilir.

Gelecekte backend sunucusuna tamamen bağlamak istediğinizde, frontend tarafındaki `App.tsx` dosyasından auth yönlendirmelerini tekrar aktif edebilirsiniz.
