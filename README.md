# 🚀 FocusForge App

<p align="center">
  <img src="Project%20Management/Daily%20Scrum/header.png" alt="FocusForge Corporate Header" width="100%" />
</p>

---

## Takım Üyeleri (Takım 56)

<table>
  <tr>
    <th>👤 Üye</th>
    <th>🎯 Scrum Rolü</th>
    <th>💻 Teknik Odak / Sorumluluk</th>
  </tr>
  <tr>
    <td><b>Hilal Uluca</b></td>
    <td>Scrum Master</td>
    <td> AI </td>
  </tr>
  <tr>
    <td><b>Furkan Türker</b></td>
    <td>Product Owner</td>
    <td> Backend </td>
  </tr>
  <tr>
    <td><b>Doğukan Kaya</b></td>
    <td>Developer</td>
    <td> AI </td>
  </tr>
  <tr>
    <td><b>Asya Aynur Gers</b></td>
    <td>Developer</td>
    <td> Frontend </td>
  </tr>
  <tr>
    <td><b>Mete Ülken</b></td>
    <td>Developer</td>
    <td> Backend </td>
  </tr>
</table>


## Ürün İle İlgili Bilgiler
<br>
<details>
<summary><b>📝 Ürün Açıklaması & Yol Haritası</b></summary>
<br>

**Yapay Zeka Destekli Otonom Performans ve Alışkanlık Yönetimi Mimarisi**

**FocusForge;** uzaktan çalışan profesyoneller, indie geliştiriciler ve disiplin inşa etmeye çalışan bireyler için tasarlanmış **proaktif ve otonom bir verimlilik platformudur.** Geleneksel "To-Do" uygulamaları, kullanıcının girdiği görevleri pasif bir şekilde listeler ve suçluluk duygusunu besler. FocusForge ise bir liste değil; kullanıcının dijital ayak iziyle anlık duygu durumunu **semantik olarak birleştiren Rasyonel bir Strateji Ortağıdır (Director Agent).** Sistem; kullanıcının uyku, ekran süresi ve tamamlanma oranları gibi verilerini analiz eder, erteleme davranışlarının altındaki kök sebepleri otonom olarak çözer ve büyük projeleri zihinsel yük yaratmayacak eylemlere (Tool Calling) böler. "Neden yapmadın?" diye sormaz; "Bu eylemsizlik seni hedefinden matematiksel olarak şu kadar saptırıyor, şimdi şu 15 dakikalık adımı at" diyerek eyleme geçirir.


* **Dual-Track (Çift Yönlü) Veritabanı Mimarisi:** Görevler (`Must-Do`) ve sürekli alışkanlıklar (`Habit`) veritabanı seviyesinde birbirinden ayrılır. 
* **Mood & Habit Tracker:** Sistem, her gün kullanıcının modunu, enerji seviyesini ve geliştirmek istediği alışkanlıklarını takip eder. Bu veriler, kullanıcının "Sorumluluk Skoru" ile eşleştirilerek, hangi günlerde daha üretken olduğunu gösteren semantik bir korelasyon matrisi oluşturur.
* **Kurban Psikolojisine Karşı Semantik Yüzleşme:** Sistem, kullanıcıyı sahte bir şekilde motive etmeye çalışmaz. Kullanıcının günlük mod bildirimlerini ve biyolojik verilerini (uyku/ekran süresi) semantik olarak analiz ederek darboğazları tespit eder. Ertelemenin maliyetini rasyonel bir şekilde önüne koyar.
* **Sorumluluk Skoru (Gamification):** Kullanıcının sistemle kurduğu ilişkinin istikrarı, geciken görevleri ve tamamlanan alışkanlıkları dinamik bir algoritmaya tabi tutularak matematiksel bir "Sorumluluk Skoru" (0-100) üretir.

### 🗺️ Üç Aşamalı Genişleme Stratejisi (Roadmap)

#### Faz 1: B2C Bireysel Asistan MVP (Mevcut Aşama)
* **Hibrit UI ve Agentic Akış:** Kullanıcının Director (AI) ile sohbet ettiği ve AI'ın arkada `break_down_task` aracıyla büyük işleri parçalayıp chatin içine onaylanabilir interaktif UI Widget'ları (Checklist Kartları) gönderdiği temel yapı.
* **Günlük Mod ve Alışkanlık Takibi:** Kullanıcının günlük enerji ve mod girişlerini veritabanına işleyen `Habit` modülünün entegrasyonu.
* **LLM Destekli Önceliklendirme:** Kullanıcının görev havuzunun arka planda LLM (Büyük Dil Modeli) ile analiz edilip otomatik Eisenhower sınıflandırmasına tabi tutulması.

#### Faz 2: Sensör ve İşletim Sistemi Entegrasyonları (Proaktif Müdahale)
* **Bağlamsal Veri Akışı:** Kullanıcının mobil cihazından veya akıllı saatinden gelen (Apple Health / Google Fit / OS Screen Time) API'lerinin sisteme entegrasyonu.
* **Otonom Tetikleyiciler:** Ekran süresi kritik eşiği aştığında veya biyolojik verilerde yorgunluk saptandığında, uygulamanın otonom bildirimler (Push Notifications) üreterek kullanıcının dijital döngüsünü kırması. Stres anlarında tetiklenen otonom nefes egzersizi öneri modülleri.

#### Faz 3: B2B Kurumsal Entegrasyon (Tükenmişlik ve Performans Yönetimi)
* **Sessiz İstifa (Quiet Quitting) Kalkanı:**   Yazılım ve mühendislik ekipleri için Jira ve Slack API entegrasyonları.
* **Erken Uyarı Dashboard'u:** Takım içindeki iş yükü dağılımının ve bireysel tükenmişlik emarelerinin (sistemde uzun süre eylemsizlik vb.) yöneticilere anonimleştirilmiş, semantik veri raporları olarak sunulması.

</details>

<details>
<summary><b>✨ Mevcut Ürün Özellikleri </b></summary>
<br>

*   **Akıllı Görev Yönetimi (Temel CRUD API):** Kullanıcıların günlük hedeflerini ekleme, silme, düzenleme ve tamamlama süreçlerinin backend entegrasyonu.
*   **Yapay Zeka Koçu Entegrasyonu:** Google Gemini API bağlantısı koordine edilerek, kullanıcının motivasyon durumuna göre stratejik, net ve proaktif geri bildirimler üreten ilk istem (prompt) şablonlarının altyapısının kurulması.
*   **Güvenli Kullanıcı Yönetimi (Auth):** Projenin iskeletini oluşturan şifreli kullanıcı kayıt ve giriş sisteminin FastAPI mimarisinde ayağa kaldırılması.

</details>

<details>
<summary><b>🎯 Hedef Kitle</b></summary>
<br>

1.  **Odak Problemi Yaşayan Bireyler:** Akademik veya profesyonel düzeyde proje hazırlığında olan, erteleme problemi yaşayan ve kişisel disiplin sağlamak isteyen insanlar.
2.  **Çalışan Profesyoneller:** Zaman yönetimi ve odak bölünmesi yaşayan bağımsız yazılımcılar, veri bilimciler ve freelancerlar.
3.  **Kurumsal Takımlar (Faz 3 Hedefi):** Mühendis verimliliğini artırmayı amaçlayan teknoloji şirketleri, startup'lar ve İK departmanları.

</details>

---

## 🔗 Product Backlog URL
FocusForge takımının Çevik (Agile) yönetim süreçleri, maliyet/efor analizleri ve kapasite ölçümleri şeffaf bir şekilde yönetilmektedir. Takım kapasitesi, Fibonacci sayıları kullanılarak hesaplanmış ve görevler "Story" ile "Task" olarak rasyonel bir hiyerarşiye oturtulmuştur.

### 📌 Sprint 1 Kapasite Raporu
* **Toplam İş Yükü (Total Story Points):** 82 Puan
* **1. Hafta Tamamlanan (Completed):** 43 Puan
* **2. Hafta İçin Kalan (Remaining):** 39 Puan

### 🔗 Canlı Yönetim Panosu
Ekibimizin güncel Product Backlog'una, görev atamalarına ve 1. Sprint Burndown (Erime) grafiğine aşağıdaki bağlantıdan ulaşabilirsiniz:

👉 **[FocusForge Miro Sprint Board & Burndown Chart](https://miro.com/welcomeonboard/U3BtZmFtcDgzYm1GdmlXUlUrZDNDU08vSFhwYmpZd01VcnlXeCtrRmhkQVZQSG5xbkxKeHZJaEkrd2d6WHNKVms5b01PVzVlR1JFRlN0a3VHYnNFOEtyd0wwMlhKTU0rSjhuUjRlUjhSVUlVQW9PckRwemF4M0dtK1hhZFFQaWlNakdSWkpBejJWRjJhRnhhb1UwcS9BPT0hdjE=?share_link_id=809806536559)**

> **Operasyonel Not:** Sistem mimarisi ve görev eforlandırması Jira üzerinde kurgulanmış olup, takımın erime hızı (velocity) ve vitrin operasyonları Miro üzerinden canlı olarak raporlanmaktadır.

---
## Sprint Süreçleri ve Yönetimi

<details>
<summary><b> Sprint 1 </b></summary>
<br>

### 📑 Backlog Düzeni ve Story Seçimleri 
Backlog'umuz projenin öncelikli çalışan iskeletini (MVP) ayağa kaldıracak kullanıcı hikayelerine (**User Story**) göre dizilmiştir. Sprint başına tahmin edilen toplam hikaye puanı, ekip üyelerinin takvim yoğunlukları dengelenerek sınırları aşmayacak şekilde belirlenmiştir. Story başına çıkan tahmin puanı, toplam puanın yarısından az tutularak risk minimize edilmiştir. Story'ler yapılacak alt teknik işlere (task'lere) bölünerek JIRA panosuna işlenmiştir.

### 💬 Daily Scrum 
Takım üyelerinin farklı şehirlerdeki yoğun takvimleri nedeniyle zamanı doğru yönetmek adına Daily Scrum toplantılarının **Slack veya WhatsApp üzerinden yazılı** ve **Meet üzerinden sesli** olmak üzere hibrit yürütülmesine karar verilmiştir. 

Sprint 1 boyunca gerçekleştirdiğimiz günlük durum değerlendirmeleri, planlama diyalogları ve akran öğrenimi süreçlerinin tüm ekran görüntüsü kanıtlarına aşağıdaki bağlantıdan tek bir klasör altında şeffafça ulaşabilirsiniz:![Daily Scrum](Project%20Management/Daily%20Scrum)
### 📊 Sprint Board Update & Ürün Durumu

| 🔄 JIRA Sprint Board | 📱 Product Screenshot |
| :--- | :--- |
| [🔗 JIRA Sprint Board Görünümü](./Project%20Management/Daily%20Scrum/Jira%20Board%201.png) | [🔗 FastAPI Swagger UI Ürün Görünümü](./UI%20Gallery/Sprint%201/FASTAPI%20Swagger%20UI%201.png) |


### 🔎 Sprint Review 
*    Sprint 1 hedefi doğrultusunda projenin temel iskeletini oluşturacak backend mimarisi başarıyla kurulmuş; **Kullanıcı Kayıt/Giriş (Auth), Görev Yönetimi (Task CRUD) ve Yapay Zeka Sohbet (AI Chat) endpoint'leri** FastAPI altyapısında başarıyla kodlanarak entegre edilmiştir.
*    Ekibin geliştirme hızını agresif bir şekilde artırmak amacıyla takım içi roller çapraz fonksiyonel (cross-functional) esneklikle yeniden organize edilmiştir. Projenin hızlıca canlıya çıkabilmesi için 2 kişi Backend altyapısına, 2 kişi AI mimarisine ve 1 kişi Frontend arayüzüne odaklanacak şekilde net bir iş bölümü yapılmıştır. Kod bloklarında tıkanma yaşanmaması adına görev dağılımları esnek tutulmaktadır.
*   **Katılımcılar:** Hilal Uluca, Furkan Türker, Doğukan Kaya, Asya Aynur Gers, Mete Ülken.

### 🔄 Sprint Retrospective 
*   İlk sprintte kod üretimine hızlıca geçilmesi ve backend API omurgasının başarıyla ayağa kaldırılması ekibin teknik koordinasyonunu kanıtlamıştır.
*   **Neleri Geliştirmeliyiz?:** Gelecek sprintte devreye girecek LangChain ve Redis hafıza yönetimi süreçleri daha karmaşık olacağından, sprint planlama toplantılarında developer tahmin puanlarının daha esnek ve detaylı geri bildirimlerle belirlenmesi gerektiği fark edilmiştir.
*   **Aksiyon Kararı:** Jüri kriterlerinde yer alan "Temiz Kod Prensipleri" ve API Optimizasyonu metriklerinden tam puan almak adına, entegrasyon testlerine ve kod inceleme (Code Review) süreçlerine ayrılacak efor/saat oranının artırılması kararı alınmıştır.

</details>

<details>
<summary><b> Sprint 2 (Planlama Aşamasında)</b></summary>
<br>

* 

</details>

<details>
<summary><b> Sprint 3 </b></summary>
<br>

*   

</details>

---
<p align="center">
  <b>Team 56 @2026 — FocusForge.</b>
</p>
