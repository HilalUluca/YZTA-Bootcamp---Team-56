/**
 * Rozet / başarım servis katmanı (YZTA-120).
 */

import api from './api';
import type { AchievementsResponse, CheckAchievementsResponse } from './types';

/** Kazanılan + katalogdaki tüm rozetleri (kilitli/açık) getirir. */
export const getAchievements = async (): Promise<AchievementsResponse> => {
  const res = await api.get<AchievementsResponse>('/achievements/');
  return res.data;
};

/**
 * Hak edilen rozetleri değerlendirir ve verir. Rozetler tamamlanma anlarında
 * otomatik de veriliyor; bu çağrı profil açılışında telafi/senkron içindir.
 */
export const checkAchievements = async (): Promise<CheckAchievementsResponse> => {
  const res = await api.post<CheckAchievementsResponse>('/achievements/check');
  return res.data;
};
