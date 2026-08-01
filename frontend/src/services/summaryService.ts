export interface DailySummary {
  title: string;
  date: string;
  highlights: string[];
  warnings: string[]; // Dikkat edilmesi gerekenler / Risk sinyalleri
  productivityScore: number;
  reflection: string[]; // 🧠 Günün stratejik sorgulama ve iç gözlem soruları
  suggestions: string[];
}

export const getDailySummaryMock = async (): Promise<DailySummary> => {
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        title: "Gün Sonu Özeti",
        date: new Date().toISOString(),
        highlights: [
          "Bugün 3 acil görev tamamladın.",
          "Toplam 2 saat odaklanmış çalışma (Pomodoro) gerçekleştirdin.",
          "Bugün ekran süren daha iyi oranlarda seyretti ancak hala hedeflediğimize yakın değil.",
          "Gelişim aşamasındaki 4 kritik alışkanlığı yorgunluk sebebiyle erteledin.",
          "Bu sana toplam 8 saat ve %15 sorumluluk skoru kaybettirdi.",
        ],
        warnings: [
          "Uyku düzenin 4 saat civarında seyrediyor: Biyolojik onarım yetersiz.",
          "Aşırı yüklenme riski",
          "Biyolojik kapasite ile hedeflenen iş yükü arasındaki uyumsuzluk",
          "Gerçekçi olmayan zaman yönetimi nedeniyle tükenmişlik riski"
        ],
        productivityScore: 70,
        reflection: [
          "Otopilotta yaşayarak bazen farkında olmadan, belirlediğimiz yaşam hedefleri sabote edebiliyoruz. Gel, gün sonunda biraz içimize çekilelim ve şunu düşünelim:",
          "'Öne sürdüğüm sebepler gerçekten geçerli mi, yoksa sadece konfor alanımdan mı çıkamadım? Bunlar hayatımın iplerini elime almama engel olan birer kılıf olabilir mi?'",
        ],
        suggestions: [
          "Yarın için en önemli 1 görevini akşamdan belirleyebilirsin. Senin için görevleri parçalayacağım.",
          "Günlük ekran süreni azaltmak ve uyku düzenin için yatmadan 1 saat önce telefonu bırakmayı dene. İstersen bir dahakine bana bildirimlerini kapatma talimatı ver veya bunu sen de yapabilirsin.",
          "Son olarak yarınki antrenmanın için telefonuna kurduğum alarmı ertelememeye çalış! 😉",
          "Unutma, mükemmel olmak zorunda değilsin. Sadece tek bir kararla hayatının kontrolünü geri alabilirsin, yapabileceğini biliyorum!",
          "Yarın burada tekrar buluşalım!👋"
        ]
      });
    }, 500);
  });
};