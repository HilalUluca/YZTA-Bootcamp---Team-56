/**
 * Kimlik doğrulama ve onboarding servis katmanı (YZTA-42).
 *
 * Sayfalar backend'e doğrudan axios ile değil, bu fonksiyonlar üzerinden erişir.
 * Böylece endpoint yolları, token saklama ve tip dönüşümü tek yerde toplanır.
 */

import api, { setToken } from './api';
import type {
  AuthToken,
  LoginPayload,
  OnboardingData,
  RegisterPayload,
  User,
} from './types';

/** Yeni kullanıcı kaydı. Başarılıysa oluşturulan kullanıcıyı döner (giriş yapmaz). */
export const register = async (payload: RegisterPayload): Promise<User> => {
  const res = await api.post<User>('/auth/register', payload);
  return res.data;
};

/**
 * Giriş yapar, dönen JWT'yi localStorage'a yazar ve token'ı döner.
 * Token yazma işini de burada yapıyoruz ki çağıran sayfa unutmasın.
 */
export const login = async (payload: LoginPayload): Promise<AuthToken> => {
  const res = await api.post<AuthToken>('/auth/login', payload);
  setToken(res.data.access_token);
  return res.data;
};

/** Mevcut token ile giriş yapmış kullanıcıyı getirir (guard ve profil için). */
export const getMe = async (): Promise<User> => {
  const res = await api.get<User>('/auth/me');
  return res.data;
};

/**
 * Onboarding cevaplarını gönderir. Backend bu cevaplardan cold-start profilini
 * üretir (YZTA-27) ve güncellenmiş kullanıcıyı döner (onboarding_completed=true).
 */
export const completeOnboarding = async (data: OnboardingData): Promise<User> => {
  const res = await api.put<User>('/auth/onboarding', data);
  return res.data;
};
