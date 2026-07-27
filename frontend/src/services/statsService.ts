/**
 * İstatistik / dashboard servis katmanı (YZTA-52).
 */

import api from './api';
import type { DashboardStats, WeeklyReport } from './types';

/** Profil/ana sayfa için özet istatistikler (XP, seviye, streak, skor, bugün). */
export const getDashboard = async (): Promise<DashboardStats> => {
  const res = await api.get<DashboardStats>('/stats/dashboard');
  return res.data;
};

/** Son 7 günün günlük kırılımı (grafik için). */
export const getWeeklyReport = async (): Promise<WeeklyReport> => {
  const res = await api.get<WeeklyReport>('/stats/weekly-report');
  return res.data;
};
