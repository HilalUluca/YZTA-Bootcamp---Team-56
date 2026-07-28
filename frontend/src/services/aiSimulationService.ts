export interface DeviceUsageMock {
  date: string;
  totalScreenHours: number;
  unproductiveHours: number;
  productiveHours: number;
  topDistractingApps: { name: string; minutes: number }[];
  freeTimeSlots: { start: string; end: string }[];
}

export interface AiInsight {
  message: string;
  potentialPomodoroCount: number;
  suggestionLevel: "low" | "medium" | "high";
  source: "simulation";
}

export interface FocusTaskPlan {
  id: string;
  title: string;
  type: "task" | "focus";
  start: string;
  end: string;
  pomodoroCount?: number;
  relatedGoal?: string;
}

const STORAGE_KEY_DATA = 'deviceUsageSimulation';
const STORAGE_KEY_PLAN = 'aiGeneratedPlan';

export const aiSimulationService = {
  // 1. Cihaz Verisi Üret & Kaydet
  generateMockDeviceData: (): DeviceUsageMock => {
    // Rastgele ama mantıklı veriler
    const unproductiveHours = parseFloat((Math.random() * (4.5 - 1.5) + 1.5).toFixed(1)); // 1.5 ile 4.5 arası

    const mockData: DeviceUsageMock = {
      date: new Date().toISOString(),
      totalScreenHours: unproductiveHours + 2.5,
      unproductiveHours: unproductiveHours,
      productiveHours: 2.5,
      topDistractingApps: [
        { name: 'Instagram', minutes: Math.floor(unproductiveHours * 60 * 0.4) },
        { name: 'TikTok', minutes: Math.floor(unproductiveHours * 60 * 0.3) },
        { name: 'X (Twitter)', minutes: Math.floor(unproductiveHours * 60 * 0.3) },
      ],
      freeTimeSlots: [
        { start: '18:00', end: '19:30' },
        { start: '20:00', end: '21:30' }
      ]
    };

    localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(mockData));
    return mockData;
  },

  getMockDeviceData: (): DeviceUsageMock | null => {
    const data = localStorage.getItem(STORAGE_KEY_DATA);
    return data ? JSON.parse(data) : null;
  },

  clearMockDeviceData: () => {
    localStorage.removeItem(STORAGE_KEY_DATA);
    localStorage.removeItem(STORAGE_KEY_PLAN); // Cihaz bağlantısı koparsa planlar da gitsin

    // React state update'leri için custom event fırlatalım
    window.dispatchEvent(new Event('ai-simulation-updated'));
  },

  // 2. AI İçgörü Üretme
  getAiInsight: (data: DeviceUsageMock): AiInsight => {
    const unproductiveMinutes = data.unproductiveHours * 60;
    const pomodoroCount = Math.floor(unproductiveMinutes / 30);

    let suggestionLevel: "low" | "medium" | "high" = "low";
    if (pomodoroCount > 6) suggestionLevel = "high";
    else if (pomodoroCount > 3) suggestionLevel = "medium";

    return {
      message: `Bugün ${data.unproductiveHours} saat boşa harcadın.`,
      potentialPomodoroCount: pomodoroCount,
      suggestionLevel,
      source: "simulation"
    };
  },

  // 3. Otomatik Plan Üret
  generateAiPlan: (data: DeviceUsageMock): boolean => {
    const existingPlans = aiSimulationService.getAiGeneratedPlan();
    if (existingPlans && existingPlans.length > 0) {
      return false; // Zaten plan var, üzerine yazmayalım
    }

    const plans: FocusTaskPlan[] = [];

    data.freeTimeSlots.forEach((slot, index) => {
      // Her boş zaman slotu için 1 odaklanma seansı oluşturalım
      plans.push({
        id: `plan-${Date.now()}-${index}`,
        title: `AI Önerisi: Derin Odak Seansı ${index + 1}`,
        type: "focus",
        start: slot.start,
        end: slot.end,
        pomodoroCount: 2,
        relatedGoal: "Günün hedefini tamamla"
      });
    });

    localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(plans));
    return true; // Başarıyla oluşturuldu
  },

  getAiGeneratedPlan: (): FocusTaskPlan[] | null => {
    const data = localStorage.getItem(STORAGE_KEY_PLAN);
    return data ? JSON.parse(data) : null;
  },

  deletePlanItem: (id: string) => {
    const currentPlans = aiSimulationService.getAiGeneratedPlan();
    if (currentPlans) {
      const updatedPlans = currentPlans.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEY_PLAN, JSON.stringify(updatedPlans));
      return updatedPlans;
    }
    return [];
  },

  // Custom event tetikleyici
  triggerUpdateEvent: () => {
    window.dispatchEvent(new Event('ai-simulation-updated'));
  }
};
