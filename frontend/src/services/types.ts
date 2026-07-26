/**
 * Backend API ile paylaşılan TypeScript tipleri.
 *
 * Bu dosya, servis katmanının (authService, profileService) tek tip kaynağıdır;
 * sayfalar bu tipleri buradan import eder, ham axios yanıtına dokunmaz.
 */

// --- Kullanıcı ---

export interface User {
  id: string;
  email: string;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
  total_xp: number;
  level: number;
  streak_count: number;
  responsibility_score: number;
  ai_profile?: Record<string, unknown> | null;
  onboarding_completed: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

// --- Kayıt / Giriş istekleri ---

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  full_name?: string | null;
}

export interface LoginPayload {
  username: string;
  password: string;
}

// --- Onboarding (YZTA-71) ---

/**
 * Onboarding formundan toplanan veri. Backend'deki OnboardingData şemasıyla
 * birebir örtüşür; tüm alanlar opsiyoneldir, kullanıcı istediğini doldurur.
 */
export interface OnboardingData {
  // Kim olduğu
  about_me?: string;
  profession?: string;
  age?: number;
  personality?: string;
  communication_style?: string;

  // Hedefler
  primary_goals?: string[]; // yıllık hedefler
  daily_goals?: string[]; // günlük hedefler / liste

  // Alışkanlıklar & operasyonel
  hobbies?: string[];
  weaknesses?: string[];
  sleep_pattern?: string;
  average_screen_time?: string;
  routine_hours_per_day?: string;
  biggest_challenge?: string;
  preferred_technique?: string;
}

// --- AI Profili (cold-start / long-term memory) ---

export interface ProfileGoals {
  short_term: string[];
  long_term: string[];
}

export interface UserProfile {
  profile_version: string;
  generated_at: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  traits: string[];
  goals: ProfileGoals;
  work_patterns: string;
  risk_signals: string[];
  coaching_preferences: string;
  personalization_hints: string[];
  evidence: string;
  last_updated_from_range: string;
}

// --- İstatistik / Dashboard (YZTA-52) ---

export interface DashboardStats {
  user: {
    username: string;
    full_name?: string | null;
    level: number;
    total_xp: number;
    streak_count: number;
  };
  tasks: {
    total: number;
    open: number;
    completed_today: number;
    overdue: number;
  };
  focus: {
    minutes_today: number;
    sessions_today: number;
    total_minutes: number;
    total_hours: number;
  };
  score: {
    value: number;
    level: string;
    coach_tone: string;
  };
  generated_at: string;
}

export interface WeeklyDay {
  date: string;
  label: string;
  focus_minutes: number;
  tasks_completed: number;
  reflections: number;
  active: boolean;
}

export interface WeeklyReport {
  days: WeeklyDay[];
  totals: {
    focus_minutes: number;
    tasks_completed: number;
    reflections: number;
    active_days: number;
  };
  streak: number;
  generated_at: string;
}

// --- Rozetler (YZTA-120) ---

export interface BadgeCatalogItem {
  key: string;
  name: string;
  description: string;
  type: string;
  xp: number;
  earned: boolean;
  earned_at?: string | null;
}

export interface AchievementsResponse {
  earned: {
    name: string;
    description: string;
    type: string;
    xp: number;
    earned_at?: string | null;
  }[];
  catalog: BadgeCatalogItem[];
  total_earned: number;
  total_badges: number;
}

export interface CheckAchievementsResponse {
  message: string;
  new_achievements: { name: string; description: string; xp: number }[];
}
