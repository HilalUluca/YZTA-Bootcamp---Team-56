import React, { useEffect, useState } from 'react';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import {
  bookOutline,
  checkmarkDoneOutline,
  flameOutline,
  flashOutline,
  logOutOutline,
  lockClosedOutline,
  mailOutline,
  moonOutline,
  ribbonOutline,
  shieldCheckmarkOutline,
  sunnyOutline,
  trophyOutline,
} from 'ionicons/icons';
import { getMe } from '../services/authService';
import { getDashboard, getWeeklyReport } from '../services/statsService';
import { getAchievements, checkAchievements } from '../services/achievementsService';
import type {
  AchievementsResponse,
  DashboardStats,
  User,
  WeeklyReport,
} from '../services/types';
import { getThemeMode, isDarkActive, setThemeMode, type ThemeMode } from '../theme/theme';
import { SettingsDeviceConnectSection } from '../components/SettingsDeviceConnectSection';
import forgeAvatar from '../assets/hmsc/circular-parrot-avatar.jpg';
import './Tab3.css';

interface Tab3Props {
  onLogout: () => void;
}

// Rozet anahtarına göre ikon (kilitli/açık farketmez).
const BADGE_ICONS: Record<string, string> = {
  first_focus: flashOutline,
  deep_focus: flameOutline,
  first_reflection: bookOutline,
  streak_5: trophyOutline,
  task_hunter: checkmarkDoneOutline,
};

/** Son 7 gün odak dakikası için gradyan bar grafiği. */
const WeeklyChart: React.FC<{ report: WeeklyReport }> = ({ report }) => {
  const max = Math.max(1, ...report.days.map((d) => d.focus_minutes));
  const hasFocus = report.totals.focus_minutes > 0;

  return (
    <div>
      <div className="profile-chart">
        {report.days.map((d) => {
          // Odak varsa yüksekliği dakikaya göre; yoksa aktif günlere ince bir iz.
          const ratio = d.focus_minutes / max;
          const heightPct = d.focus_minutes > 0 ? Math.max(8, ratio * 100) : d.active ? 6 : 3;
          return (
            <div key={d.date} className="profile-chart-col">
              <div className="profile-chart-track">
                <div
                  className={`profile-chart-bar ${d.active ? 'is-active' : ''}`}
                  title={`${d.focus_minutes} dk odak · ${d.tasks_completed} görev · ${d.reflections} yansıma`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="profile-chart-label">{d.label}</span>
            </div>
          );
        })}
      </div>
      <p className="profile-chart-summary">
        {hasFocus
          ? `Bu hafta toplam ${report.totals.focus_minutes} dk odaklanma · ${report.totals.active_days}/7 aktif gün`
          : `Bu hafta ${report.totals.active_days}/7 aktif gün — henüz odak seansı yok`}
      </p>
    </div>
  );
};

const Tab3: React.FC<Tab3Props> = ({ onLogout }) => {
  const [me, setMe] = useState<User | null>(null);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [achievements, setAchievements] = useState<AchievementsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState('');

  // Tema tercihi. Kaynak <html> sınıflarıdır; buradaki state sadece
  // başlıktaki güneş/ay ikonunu tazelemek için tutuluyor (bkz. theme/theme.ts).
  const [themeMode, setMode] = useState<ThemeMode>(getThemeMode);
  const darkActive = isDarkActive(themeMode);

  const changeTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    setMode(mode);
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // Profil açılışında rozetleri değerlendir (otomatik telafi), sonra oku.
        await checkAchievements().catch(() => undefined);
        const [meData, dash, week, ach] = await Promise.all([
          getMe(),
          getDashboard(),
          getWeeklyReport(),
          getAchievements(),
        ]);
        setMe(meData);
        setDashboard(dash);
        setWeekly(week);
        setAchievements(ach);
      } catch {
        setToast('Profil verileri yüklenemedi. Lütfen tekrar dene.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // XP çubuğu (backend: her 500 XP = 1 seviye).
  const xpNeeded = 500;
  const totalXp = dashboard?.user.total_xp ?? 0;
  const currentLevelXp = totalXp % xpNeeded;
  const xpProgress = currentLevelXp / xpNeeded;

  const streak = dashboard?.user.streak_count ?? 0;
  const score = dashboard?.score.value ?? 0;

  const displayName = me ? me.full_name || me.username : '';

  return (
    <IonPage className="ff-page">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Profil</IonTitle>
          <IonButtons slot="end">
            {/* Tek dokunuşla açık ↔ koyu. Hiç dokunulmadıysa tema cihazın
                tercihini takip eder ('system' modu, bkz. theme/theme.ts). */}
            <button
              className="theme-toggle"
              onClick={() => changeTheme(darkActive ? 'light' : 'dark')}
              aria-label={darkActive ? 'Açık temaya geç' : 'Koyu temaya geç'}
              title={darkActive ? 'Açık temaya geç' : 'Koyu temaya geç'}
            >
              <IonIcon icon={darkActive ? sunnyOutline : moonOutline} />
            </button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {isLoading && !me && (
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
            <IonSpinner name="crescent" color="primary" />
            <p className="ff-subtitle">Yükleniyor...</p>
          </div>
        )}

        {me && dashboard && (
          <div className="profile-shell">
            <section className="profile-hero ff-rise">
              <div className="profile-avatar">
                <img src={forgeAvatar} alt="Forge profil fotoğrafı" />
                <span className="profile-avatar-status" aria-label="Aktif" />
              </div>
              <div className="profile-identity">
                <span className="profile-eyebrow">FOCUSFORGE PROFİLİ</span>
                <h1>{displayName}</h1>
                <p>@{me.username}</p>
                <span className="profile-level-pill"><IonIcon icon={trophyOutline} /> Seviye {dashboard.user.level}</span>
              </div>
              <div className="profile-xp-block">
                <div><span>Seviye ilerlemen</span><strong>{currentLevelXp} / {xpNeeded} XP</strong></div>
                <div className="profile-xp-track"><span style={{ width: `${xpProgress * 100}%` }} /></div>
                <small>Sonraki seviyeye {xpNeeded - currentLevelXp} XP kaldı · Toplam {totalXp} XP</small>
              </div>
            </section>

            <section className="profile-overview ff-rise" style={{ '--ff-delay': '0.05s' } as React.CSSProperties}>
              <div className="is-streak"><IonIcon icon={flameOutline} /><strong>{streak}</strong><span>Günlük seri</span></div>
              <div className="is-score"><IonIcon icon={shieldCheckmarkOutline} /><strong>%{score.toFixed(0)}</strong><span>Sorumluluk</span></div>
              <div className="is-badge"><IonIcon icon={ribbonOutline} /><strong>{achievements ? achievements.total_earned : '—'}</strong><span>Kazanılan rozet</span></div>
              <div className="is-xp"><IonIcon icon={flashOutline} /><strong>{totalXp}</strong><span>Toplam XP</span></div>
            </section>

            <section className="profile-score-card ff-rise" style={{ '--ff-delay': '0.1s' } as React.CSSProperties}>
              <div className="profile-score-ring" style={{ '--score': `${Math.min(100, Math.max(0, score)) * 3.6}deg` } as React.CSSProperties}>
                <span>%{score.toFixed(0)}</span>
              </div>
              <div>
                <span className="profile-eyebrow">HAFTALIK KARARLILIK</span>
                <h2>Ritmini koruyorsun</h2>
                <p>Forge, son 7 gündeki görev ve odak düzenine göre bu skoru hesaplıyor.</p>
              </div>
            </section>

            {/* Son 7 gün */}
            {weekly && (
              <section className="profile-section">
                <div className="profile-section-heading"><div><span className="profile-eyebrow">GELİŞİMİN</span><h2>Son 7 gün</h2></div><span>{weekly.totals.active_days}/7 aktif</span></div>
                <div className="profile-panel ff-rise" style={{ '--ff-delay': '0.15s' } as React.CSSProperties}>
                  <WeeklyChart report={weekly} />
                </div>
              </section>
            )}

            {/* Rozetler */}
            {achievements && (
              <section className="profile-section">
                <div className="profile-section-heading"><div><span className="profile-eyebrow">BAŞARILARIN</span><h2>Rozetler</h2></div><span>{achievements.total_earned}/{achievements.total_badges}</span></div>
                <div className="profile-panel ff-rise" style={{ '--ff-delay': '0.2s' } as React.CSSProperties}>
                  <div className="profile-badges">
                    {achievements.catalog.map((b) => (
                      <div
                        key={b.key}
                        title={b.description}
                        className={`profile-badge ${b.earned ? 'is-earned' : ''}`}
                      >
                        <span className="profile-badge-icon">
                          <IonIcon
                            icon={b.earned ? BADGE_ICONS[b.key] ?? ribbonOutline : lockClosedOutline}
                          />
                        </span>
                        <span className="profile-badge-name">{b.name}</span>
                        <span className="profile-badge-meta">
                          {b.earned ? `+${b.xp} XP` : 'Kilitli'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Hesap */}
            <section className="profile-section">
              <div className="profile-section-heading"><div><span className="profile-eyebrow">KİŞİSEL BİLGİLER</span><h2>Hesap</h2></div></div>
              <div className="profile-account-row ff-rise" style={{ '--ff-delay': '0.25s' } as React.CSSProperties}>
                <span><IonIcon icon={mailOutline} /></span>
                <div><small>E-posta adresi</small><strong>{me.email}</strong></div>
              </div>
            </section>

            {/* AI Cihaz Verileri Simülasyonu */}
            <section className="profile-section profile-connections">
              <div className="profile-section-heading"><div><span className="profile-eyebrow">ENTEGRASYONLAR</span><h2>Bağlantılar</h2></div></div>
              <SettingsDeviceConnectSection />
            </section>

            {/* Çıkış */}
            <button
              className="ff-btn ff-btn-ghost profile-logout"
              onClick={onLogout}
            >
              <IonIcon icon={logOutOutline} style={{ fontSize: '19px' }} />
              Çıkış Yap
            </button>
          </div>
        )}

        <IonToast isOpen={!!toast} onDidDismiss={() => setToast('')} message={toast} duration={2500} />
      </IonContent>
    </IonPage>
  );
};

export default Tab3;
