/**
 * AI profil servis katmanı (YZTA-42).
 *
 * Cold-start profili onboarding sırasında backend'de üretilir; bu servis onu
 * okumak ve (yeterli davranış verisi biriktiğinde) yeniden üretmek için kullanılır.
 */

import api from './api';
import type { UserProfile } from './types';

/**
 * Kullanıcının kalıcı AI profilini getirir.
 * Henüz profil yoksa backend 404 döner — çağıran taraf bunu yakalamalı.
 */
export const getProfile = async (): Promise<UserProfile> => {
  const res = await api.get<UserProfile>('/profile/');
  return res.data;
};

/**
 * Davranış verilerinden (chat/görev/yansıma) profili yeniden üretir.
 * Gemini API anahtarı gerektirir; anahtar yoksa backend 503 döner.
 */
export const generateProfile = async (): Promise<UserProfile> => {
  const res = await api.post<UserProfile>('/profile/generate');
  return res.data;
};
