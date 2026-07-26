import React, { useEffect, useState } from 'react';
import {
  IonAvatar,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonLoading,
  IonPage,
  IonProgressBar,
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
  personCircleOutline,
  ribbonOutline,
  shieldCheckmarkOutline,
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

/** Son 7 gün odak dakikası için basit CSS bar grafiği. */
const WeeklyChart: React.FC<{ report: WeeklyReport }> = ({ report }) => {
  const max = Math.max(1, ...report.days.map((d) => d.focus_minutes));
  const hasFocus = report.totals.focus_minutes > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '6px',
          height: '120px',
          padding: '8px 0',
        }}
      >
        {report.days.map((d) => {
          // Odak varsa yüksekliği dakikaya göre; yoksa aktif günlere ince bir iz.
          const ratio = d.focus_minutes / max;
          const heightPct = d.focus_minutes > 0 ? Math.max(8, ratio * 100) : d.active ? 6 : 3;
          return (
            <div
              key={d.date}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%' }}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                <div
                  title={`${d.focus_minutes} dk odak · ${d.tasks_completed} görev · ${d.reflections} yansıma`}
                  style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    borderRadius: '6px 6px 0 0',
                    background: d.active
                      ? 'var(--ion-color-primary)'
                      : 'rgba(var(--ion-color-primary-rgb), 0.18)',
                    transition: 'height 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--ion-color-medium)' }}>{d.label}</span>
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--ion-color-medium)', marginTop: '4px' }}>
        {hasFocus
          ? `Bu hafta toplam ${report.totals.focus_minutes} dk odaklanma · ${report.totals.active_days}/7 aktif gün`
          : `Bu hafta ${report.totals.active_days}/7 aktif gün — henüz odak seansı yok`}
      </div>
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
      } catch (err) {
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Profilim</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonLoading isOpen={isLoading} message="Yükleniyor..." />

        {me && dashboard && (
          <div>
            {/* Profil başlığı */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '16px 0 24px' }}>
              <IonAvatar style={{ width: '96px', height: '96px', marginBottom: '12px' }}>
                <IonIcon icon={personCircleOutline} style={{ width: '100%', height: '100%', color: 'var(--ion-color-primary)' }} />
              </IonAvatar>
              <h2 style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>{me.full_name || me.username}</h2>
              <p style={{ color: 'var(--ion-color-medium)', margin: 0 }}>@{me.username}</p>
            </div>

            {/* Özet tiller: Streak · Seviye · Sorumluluk */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={tileStyle}>
                <IonIcon icon={flameOutline} style={{ fontSize: '26px', color: 'var(--ion-color-danger)' }} />
                <div style={tileNum}>{streak}</div>
                <div style={tileLabel}>Gün Seri</div>
              </div>
              <div style={tileStyle}>
                <IonIcon icon={trophyOutline} style={{ fontSize: '26px', color: 'var(--ion-color-warning)' }} />
                <div style={tileNum}>{dashboard.user.level}</div>
                <div style={tileLabel}>Seviye</div>
              </div>
              <div style={tileStyle}>
                <IonIcon icon={shieldCheckmarkOutline} style={{ fontSize: '26px', color: 'var(--ion-color-secondary)' }} />
                <div style={tileNum}>%{score.toFixed(0)}</div>
                <div style={tileLabel}>Sorumluluk</div>
              </div>
            </div>

            {/* Seviye & XP */}
            <IonCard style={{ borderRadius: '12px', marginBottom: '16px' }}>
              <IonCardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={trophyOutline} color="warning" style={{ fontSize: '24px' }} />
                  <IonCardTitle style={{ fontSize: '20px' }}>Seviye & XP</IonCardTitle>
                </div>
                <IonCardSubtitle>Toplam {totalXp} XP · Görevleri tamamla, seviye atla!</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                  <span>Seviye {dashboard.user.level}</span>
                  <span>{currentLevelXp} / {xpNeeded} XP</span>
                </div>
                <IonProgressBar value={xpProgress} color="warning" style={{ height: '8px', borderRadius: '4px' }} />
              </IonCardContent>
            </IonCard>

            {/* Sorumluluk skoru */}
            <IonCard style={{ borderRadius: '12px', marginBottom: '16px' }}>
              <IonCardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={shieldCheckmarkOutline} color="secondary" style={{ fontSize: '24px' }} />
                  <IonCardTitle style={{ fontSize: '20px' }}>Sorumluluk Skoru</IonCardTitle>
                </div>
                <IonCardSubtitle>Son 7 günün performansına göre AI koçunun kararlılık puanı.</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                  <span>Kararlılık Puanı</span>
                  <span>%{score.toFixed(0)}</span>
                </div>
                <IonProgressBar value={score / 100} color="secondary" style={{ height: '8px', borderRadius: '4px' }} />
              </IonCardContent>
            </IonCard>

            {/* Son 7 gün grafiği */}
            {weekly && (
              <IonCard style={{ borderRadius: '12px', marginBottom: '16px' }}>
                <IonCardHeader>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IonIcon icon={flashOutline} color="primary" style={{ fontSize: '24px' }} />
                    <IonCardTitle style={{ fontSize: '20px' }}>Son 7 Gün</IonCardTitle>
                  </div>
                  <IonCardSubtitle>Günlük odaklanma ve aktiflik.</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <WeeklyChart report={weekly} />
                </IonCardContent>
              </IonCard>
            )}

            {/* Rozetler */}
            {achievements && (
              <IonCard style={{ borderRadius: '12px', marginBottom: '16px' }}>
                <IonCardHeader>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <IonIcon icon={ribbonOutline} color="warning" style={{ fontSize: '24px' }} />
                    <IonCardTitle style={{ fontSize: '20px' }}>Rozetler</IonCardTitle>
                  </div>
                  <IonCardSubtitle>
                    {achievements.total_earned} / {achievements.total_badges} rozet kazanıldı.
                  </IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                      gap: '12px',
                    }}
                  >
                    {achievements.catalog.map((b) => (
                      <div
                        key={b.key}
                        title={b.description}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          gap: '6px',
                          padding: '12px 6px',
                          borderRadius: '12px',
                          background: b.earned
                            ? 'rgba(var(--ion-color-warning-rgb), 0.12)'
                            : 'rgba(var(--ion-color-medium-rgb), 0.08)',
                          opacity: b.earned ? 1 : 0.55,
                        }}
                      >
                        <IonIcon
                          icon={b.earned ? BADGE_ICONS[b.key] ?? ribbonOutline : lockClosedOutline}
                          style={{
                            fontSize: '30px',
                            color: b.earned ? 'var(--ion-color-warning)' : 'var(--ion-color-medium)',
                          }}
                        />
                        <span style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.2 }}>{b.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--ion-color-medium)' }}>
                          {b.earned ? `+${b.xp} XP` : 'Kilitli'}
                        </span>
                      </div>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            {/* Hesap bilgisi */}
            <IonList inset style={{ borderRadius: '12px', marginBottom: '16px' }}>
              <IonItem>
                <IonLabel>
                  <p>E-posta Adresi</p>
                  <h3>{me.email}</h3>
                </IonLabel>
              </IonItem>
            </IonList>

            {/* Çıkış */}
            <IonButton
              expand="block"
              color="danger"
              fill="outline"
              onClick={onLogout}
              style={{ '--border-radius': '10px', fontWeight: 'bold', marginTop: '8px', marginBottom: '24px' }}
            >
              <IonIcon slot="start" icon={logOutOutline} />
              Çıkış Yap
            </IonButton>
          </div>
        )}

        <IonToast isOpen={!!toast} onDidDismiss={() => setToast('')} message={toast} duration={2500} />
      </IonContent>
    </IonPage>
  );
};

const tileStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '16px 6px',
  borderRadius: '14px',
  background: 'var(--ion-color-step-50, rgba(127,127,127,0.08))',
};
const tileNum: React.CSSProperties = { fontSize: '24px', fontWeight: 800 };
const tileLabel: React.CSSProperties = { fontSize: '12px', color: 'var(--ion-color-medium)' };

export default Tab3;
