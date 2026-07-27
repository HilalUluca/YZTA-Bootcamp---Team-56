export interface DailySummary {
  title: string;
  date: string;
  highlights: string[];
  productivityScore: number;
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
          "Bugün 3 kritik görev tamamladın.",
          "Toplam 2 saat odaklanmış çalışma (Pomodoro) gerçekleştirdin.",
          "Sabah planlamana sadık kaldın."
        ],
        productivityScore: 85,
        suggestions: [
          "Yarın için en önemli 1 görevini akşamdan belirleyebilirsin.",
          "Günlük ekran süreni azaltmak için yatmadan 1 saat önce telefonu bırakmayı dene."
        ]
      });
    }, 500);
  });
};
