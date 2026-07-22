import axios from 'axios';

// FastAPI backend sunucumuzun base URL'i.
// Production'da VITE_API_URL ile override edilir (bkz. .env.example).
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

// Token'ı localStorage'da tuttuğumuz anahtar.
export const TOKEN_KEY = 'token';

// Oturum düşünce (401) tetiklenen olay. App.tsx bunu dinleyip Login'e döner.
export const AUTH_LOGOUT_EVENT = 'auth:logout';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Her istekte token varsa otomatik olarak Authorization header'ına ekle
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Token süresi dolduysa / geçersizse backend 401 döner.
// Bu durumda token'ı temizleyip uygulamayı Login ekranına yönlendiriyoruz.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? '';
    // Login/register'ın kendi 401'i (hatalı şifre) oturum düşmesi değildir.
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');

    if (error.response?.status === 401 && !isAuthAttempt) {
      clearToken();
      window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;
