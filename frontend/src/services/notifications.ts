/**
 * Seans bitiminde kullanıcıyı uyarmak için bildirim yardımcıları.
 *
 * Üç kanaldan aynı anda haber veriyoruz, çünkü hiçbiri tek başına
 * her cihazda çalışmıyor:
 *   1. Sistem bildirimi (Notification API) — uygulama arka plandayken görünür
 *   2. Kısa bip sesi (Web Audio) — ek ses dosyası gerektirmiyor
 *   3. Titreşim (Capacitor Haptics) — mobilde sessiz moddayken tek uyarı
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

const isSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const getNotificationPermission = (): NotificationPermissionState =>
  isSupported() ? Notification.permission : 'unsupported';

/**
 * Bildirim izni ister. Tarayıcılar bunu yalnızca kullanıcı etkileşimi
 * (tıklama) içinde kabul ediyor, o yüzden "Başlat" anında çağırıyoruz.
 */
export const requestNotificationPermission = async (): Promise<NotificationPermissionState> => {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

// --- Ses ---

let audioContext: AudioContext | null = null;

/**
 * AudioContext'i hazırlar. iOS/Safari kullanıcı etkileşimi olmadan ses
 * çalmaya izin vermediği için seans başlarken bir kez çağrılmalı.
 */
export const primeAudio = () => {
  try {
    if (!audioContext) {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      audioContext = new Ctx();
    }
    if (audioContext.state === 'suspended') void audioContext.resume();
  } catch {
    audioContext = null;
  }
};

/** Yükselen iki notalık kısa bir "seans bitti" bipi çalar. */
const playChime = () => {
  try {
    primeAudio();
    if (!audioContext) return;

    const now = audioContext.currentTime;
    // 880 Hz ve 1174 Hz: kulağı tırmalamayan, net duyulan bir ikili.
    [
      { freq: 880, at: 0 },
      { freq: 1174, at: 0.18 },
    ].forEach(({ freq, at }) => {
      const osc = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Ani başlayıp sönerek biten zarf (klik sesini önler)
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(0.25, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + at + 0.35);

      osc.connect(gain).connect(audioContext!.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.4);
    });
  } catch {
    // Ses çalınamazsa sessizce geç; bildirim ve titreşim yine devrede.
  }
};

// --- Titreşim ---

const vibrate = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch {
    // Masaüstü tarayıcıda titreşim yok; sorun değil.
  }
};

// --- Ana giriş noktası ---

/**
 * Odaklanma seansı bittiğinde çağrılır: ses + titreşim + sistem bildirimi.
 *
 * Not: Tarayıcılar arka plandaki sekmelerde zamanlayıcıları kısıtladığı için
 * bildirim birkaç saniye gecikebilir. Native (Capacitor) build'de tam zamanlı
 * uyarı istenirse @capacitor/local-notifications ile schedule edilmeli.
 */
export const notifySessionFinished = async (durationMin: number) => {
  playChime();
  void vibrate();

  if (!isSupported() || Notification.permission !== 'granted') return;

  try {
    const notification = new Notification('Seans bitti! 🎉', {
      body: `${durationMin} dakikalık odaklanma seansını tamamladın. Seansı değerlendir.`,
      icon: '/favicon.png',
      tag: 'focusforge-session-end', // aynı seans için tek bildirim
      requireInteraction: true, // kullanıcı görene kadar ekranda kalsın
    });

    // Bildirime tıklayınca uygulamaya geri dön.
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Bildirim oluşturulamazsa in-app modal zaten kullanıcıyı bilgilendiriyor.
  }
};
