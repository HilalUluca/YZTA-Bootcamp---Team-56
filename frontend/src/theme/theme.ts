/**
 * Tema modu yönetimi.
 *
 * Üç mod var:
 *   'system' — cihazın (işletim sisteminin) tercihini takip eder (varsayılan)
 *   'light'  — her zaman açık
 *   'dark'   — her zaman koyu
 *
 * Uygulanan sınıflar <html> üzerindedir:
 *   .ion-palette-dark — Ionic'in kendi koyu paleti (dark.class.css)
 *   .ff-dark          — bizim tasarım sistemimizin koyu token'ları
 *
 * CSS tarafında `@media (prefers-color-scheme: dark)` KULLANMIYORUZ; çünkü
 * kullanıcı seçimi medya sorgusunu ezemez. Bunun yerine sistem tercihini
 * burada okuyup her zaman açık bir sınıf yazıyoruz.
 */

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'ff-theme';

const isMode = (v: unknown): v is ThemeMode =>
  v === 'system' || v === 'light' || v === 'dark';

/** Kayıtlı tercihi oku; yoksa (veya bozuksa) 'system'. */
export const getThemeMode = (): ThemeMode => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isMode(saved) ? saved : 'system';
  } catch {
    // localStorage kapalıysa (gizli sekme vb.) sistem tercihiyle devam et.
    return 'system';
  }
};

/** Cihazın şu anki tercihi koyu mu? */
export const prefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

/** Seçilen mod ve cihaz tercihine göre ekranda koyu tema mı görünüyor? */
export const isDarkActive = (mode: ThemeMode = getThemeMode()): boolean =>
  mode === 'dark' || (mode === 'system' && prefersDark());

/** Sınıfları <html>'e yaz. */
const paint = (dark: boolean) => {
  const root = document.documentElement;
  root.classList.toggle('ion-palette-dark', dark);
  root.classList.toggle('ff-dark', dark);
};

/** Modu kaydet ve hemen uygula. */
export const setThemeMode = (mode: ThemeMode) => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Yazamazsak da tema bu oturumda uygulanmaya devam etsin.
  }
  paint(isDarkActive(mode));
};

/**
 * Uygulama açılışında bir kez çağrılır: kayıtlı modu uygular ve 'system'
 * modundayken cihaz temasındaki değişikliği canlı takip eder.
 */
export const initTheme = () => {
  paint(isDarkActive());

  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    // Kullanıcı açıkça 'light'/'dark' seçtiyse cihazı dinlemiyoruz.
    if (getThemeMode() === 'system') paint(prefersDark());
  });
};
