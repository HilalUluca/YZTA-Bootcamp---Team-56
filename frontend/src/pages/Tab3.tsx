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
      <p className="ff-subtitle" style={{ fontSize: '13px', marginTop: '14px' }}>
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
        // Profil açılışında rozetleri değerlendir, sonra oku.
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
      } catch (err) {
        setToast('Profil verileri yüklenemedi. Lütfen tekrar dene.');
      } finally {
        setIsLoading(false);
      }
    };
    
    // 1. Sayfa ilk açıldığında verileri yükle
    load();

    // 2. STRATEJİK HAMLE: Chat sayfasından (Tab2) gelen güncellemeleri dinle!
    window.addEventListener('refresh_dashboard', load);

    // 3. Hafıza sızıntısı olmaması için sayfa kapanınca dinlemeyi bırak
    return () => {
      window.removeEventListener('refresh_dashboard', load);
    };
  }, []);
   

  // XP çubuğu (backend: her 500 XP = 1 seviye).
  const xpNeeded = 500;
  const totalXp = dashboard?.user.total_xp ?? 0;
  const currentLevelXp = totalXp % xpNeeded;
  const xpProgress = currentLevelXp / xpNeeded;

  const streak = dashboard?.user.streak_count ?? 0;
  const score = dashboard?.score.value ?? 0;

  const displayName = me ? me.full_name || me.username : '';
  const initial = displayName.trim().charAt(0) || '?';

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
          <div style={{ padding: '4px 18px 28px' }}>
            {/* Kimlik */}
            <div
              className="ff-rise"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                margin: '12px 0 24px',
              }}
            >
              <div className="profile-avatar">
                <div className="profile-avatar-inner">{initial}</div>
              </div>
              <h1 className="ff-title" style={{ fontSize: '26px', marginTop: '14px' }}>
                {displayName}
              </h1>
              <p className="ff-subtitle">@{me.username}</p>
            </div>

            {/* Özet istatistikler */}
            <div
              className="ff-stat-grid ff-rise"
              style={{ '--ff-delay': '0.05s' } as React.CSSProperties}
            >
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-primary">
                  <IonIcon icon={flameOutline} />
                </span>
                <span className="ff-stat-value">{streak}</span>
                <span className="ff-stat-label">Günlük Seri</span>
              </div>
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-gold">
                  <IonIcon icon={trophyOutline} />
                </span>
                <span className="ff-stat-value">{dashboard.user.level}</span>
                <span className="ff-stat-label">Seviye</span>
              </div>
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-cool">
                  <IonIcon icon={shieldCheckmarkOutline} />
                </span>
                <span className="ff-stat-value">%{score.toFixed(0)}</span>
                <span className="ff-stat-label">Sorumluluk</span>
              </div>
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-mint">
                  <IonIcon icon={ribbonOutline} />
                </span>
                <span className="ff-stat-value">
                  {achievements ? achievements.total_earned : '—'}
                </span>
                <span className="ff-stat-label">
                  {achievements ? `${achievements.total_badges} rozetten` : 'Rozet'}
                </span>
              </div>
            </div>

            {/* Seviye & XP */}
            <div
              className="ff-card ff-rise"
              style={{ marginTop: '14px', '--ff-delay': '0.1s' } as React.CSSProperties}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Seviye {dashboard.user.level}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ff-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {currentLevelXp} / {xpNeeded} XP
                </span>
              </div>
              <div className="ff-progress">
                <div className="ff-progress-fill is-gold" style={{ width: `${xpProgress * 100}%` }} />
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'var(--ff-text-muted)' }}>
                Sonraki seviyeye{' '}
                <strong style={{ color: 'var(--ff-text-soft)' }}>
                  {xpNeeded - currentLevelXp} XP
                </strong>{' '}
                kaldı · Toplam {totalXp} XP
              </p>
            </div>

            {/* Sorumluluk skoru */}
            <div
              className="ff-card ff-rise"
              style={{ marginTop: '14px', '--ff-delay': '0.15s' } as React.CSSProperties}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                  Sorumluluk Skoru
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--ff-text-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  %{score.toFixed(0)}
                </span>
              </div>
              <div className="ff-progress">
                <div className="ff-progress-fill is-cool" style={{ width: `${score}%` }} />
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'var(--ff-text-muted)' }}>
                Son 7 günün performansına göre AI koçunun kararlılık puanı.
              </p>
            </div>

            {/* Son 7 gün */}
            {weekly && (
              <>
                <h2 className="ff-section-title">Son 7 Gün</h2>
                <div
                  className="ff-card ff-rise"
                  style={{ '--ff-delay': '0.2s' } as React.CSSProperties}
                >
                  <WeeklyChart report={weekly} />
                </div>
              </>
            )}

            {/* Rozetler */}
            {achievements && (
              <>
                <h2 className="ff-section-title">
                  Rozetler{' '}
                  <span
                    style={{ fontSize: '15px', fontWeight: 600, color: 'var(--ff-text-muted)' }}
                  >
                    {achievements.total_earned}/{achievements.total_badges}
                  </span>
                </h2>
                <div
                  className="ff-card ff-rise"
                  style={{ '--ff-delay': '0.25s' } as React.CSSProperties}
                >
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
              </>
            )}

            {/* Hesap */}
            <h2 className="ff-section-title">Hesap</h2>
            <div className="ff-row ff-rise" style={{ '--ff-delay': '0.3s' } as React.CSSProperties}>
              <span className="ff-stat-icon ff-icon-cool">
                <IonIcon icon={mailOutline} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="ff-row-sub" style={{ margin: 0 }}>E-posta Adresi</p>
                <p className="ff-row-title" style={{ overflowWrap: 'anywhere' }}>{me.email}</p>
              </div>
            </div>

            {/* Çıkış */}
            <button
              className="ff-btn ff-btn-ghost profile-logout"
              onClick={onLogout}
              style={{ marginTop: '18px' }}
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
