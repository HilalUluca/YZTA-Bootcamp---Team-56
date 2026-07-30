import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from '@ionic/react';
import {
  checkmarkDoneOutline,
  flashOutline,
  flameOutline,
  trophyOutline,
  alertCircleOutline,
  journalOutline,
  chevronForwardOutline,
  sparklesOutline,
  repeatOutline,
  statsChartOutline,
} from 'ionicons/icons';
import api from '../services/api';
import parrotImg from '../assets/parrot-login.png';
import Reflection, { ReflectionData } from './Reflection';
import DailyPlan from './DailyPlan';
import Habits from './Habits';

interface DashboardData {
  user: {
    username: string;
    full_name: string | null;
    level: number;
    total_xp: number;
    streak_count: number;
  };
  tasks: {
    total: number;
    open: number;
    completed_today: number;
    overdue: number;
    todays_list: { id: string; title: string; priority: string; status: string }[];
  };
  focus: {
    minutes_today: number;
    sessions_today: number;
    total_hours: number;
  };
  score: {
    value: number;
    level: string;
    coach_tone: string;
  };
}

const XP_PER_LEVEL = 500; // Backend formülü: level = total_xp // 500 + 1

/** Saate göre selamlama — küçük bir kişiselleştirme dokunuşu. */
const greetingFor = (hour: number) => {
  if (hour < 6) return 'İyi geceler';
  if (hour < 12) return 'Günaydın';
  if (hour < 18) return 'İyi günler';
  return 'İyi akşamlar';
};

const Home: React.FC = () => {
  const history = useHistory();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Günlük yansıma
  const [todayReflection, setTodayReflection] = useState<ReflectionData | null>(null);
  const [showReflection, setShowReflection] = useState<boolean>(false);

  // AI günlük plan
  const [showPlan, setShowPlan] = useState<boolean>(false);

  // Alışkanlıklar
  const [showHabits, setShowHabits] = useState<boolean>(false);

  const loadDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/stats/dashboard');
      setData(res.data);
    } catch (err) {
      setError('Ana sayfa yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    } finally {
      setIsLoading(false);
    }
  };

  // Bugünün yansıması var mı? Backend yoksa 404 döner → henüz yapılmamış demektir.
  const loadTodayReflection = async () => {
    try {
      const res = await api.get('/reflections/today');
      setTodayReflection(res.data);
    } catch (err) {
      setTodayReflection(null);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadTodayReflection();
  }, []);

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadDashboard(), loadTodayReflection()]);
    event.detail.complete();
  };

  // Karşılamada yalnızca ilk ismi göster (örn. "Aynur Gers" -> "Aynur").
  // İsim boşsa kullanıcı adına düşer.
  const name = data
    ? (data.user.full_name || '').trim().split(' ')[0] || data.user.username
    : '';

  // Seviye ilerlemesi
  const xpIntoLevel = data ? data.user.total_xp % XP_PER_LEVEL : 0;
  const levelProgress = xpIntoLevel / XP_PER_LEVEL;

  // Bugünün plan ilerlemesi
  const doneToday = data ? data.tasks.completed_today : 0;
  const remaining = data ? data.tasks.open : 0;
  const totalToday = doneToday + remaining;
  const planProgress = totalToday > 0 ? doneToday / totalToday : 0;

  const openTasks = data ? data.tasks.todays_list.filter((t) => t.status !== 'done') : [];

  return (
    <IonPage className="ff-page">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Ana Sayfa</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '4px 18px 28px' }}>
          {/* Yükleniyor */}
          {isLoading && !data && (
            <div style={{ textAlign: 'center', marginTop: '80px' }}>
              <IonSpinner name="crescent" color="primary" />
              <p style={{ color: 'var(--ff-text-muted)' }}>Yükleniyor...</p>
            </div>
          )}

          {/* Hata */}
          {error && !data && (
            <div className="ff-empty ff-rise">
              <span className="ff-empty-icon">
                <IonIcon icon={alertCircleOutline} />
              </span>
              <h3 className="ff-title" style={{ fontSize: '22px' }}>Bir sorun oluştu</h3>
              <p className="ff-subtitle">{error}</p>
              <button className="ff-btn ff-btn-ghost ff-btn-auto" onClick={loadDashboard}>
                Tekrar Dene
              </button>
            </div>
          )}

          {data && (
            <>
              {/* Karşılama */}
              <div
                className="ff-rise"
                style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '6px 0 22px' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="ff-subtitle" style={{ fontSize: '14px', fontWeight: 600 }}>
                    {greetingFor(new Date().getHours())}
                  </p>
                  <h1 className="ff-title" style={{ overflowWrap: 'anywhere' }}>
                    {name} <span style={{ WebkitTextFillColor: 'initial' }}>👋</span>
                  </h1>
                </div>
                <div
                  style={{
                    width: '62px',
                    height: '62px',
                    borderRadius: '22px',
                    flexShrink: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--ff-glass-bg-strong)',
                    border: '1px solid var(--ff-glass-border)',
                    boxShadow: 'var(--ff-shadow-md)',
                    backdropFilter: 'var(--ff-glass-blur)',
                    WebkitBackdropFilter: 'var(--ff-glass-blur)',
                  }}
                >
                  <img
                    src={parrotImg}
                    alt=""
                    style={{ width: '46px', height: '46px', objectFit: 'contain' }}
                  />
                </div>
              </div>

              {/* HERO — bugünün planı, günün ana eylemi */}
              <div className="ff-card-hero ff-rise" style={{ '--ff-delay': '0.05s' } as React.CSSProperties}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '14px',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: 600, opacity: 0.92 }}>
                      Bugünün Planı
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '5px 11px',
                        borderRadius: '999px',
                        background: 'rgba(255,255,255,0.22)',
                      }}
                    >
                      {totalToday === 0
                        ? 'Görev yok'
                        : remaining > 0
                        ? `${remaining} görev kaldı`
                        : 'Hepsi tamam 🎉'}
                    </span>
                  </div>

                  {totalToday === 0 ? (
                    /* Hiç görev yok: sayı/çubuk yerine boş durum mesajı */
                    <div style={{ marginTop: '6px', fontSize: '15px', fontWeight: 600, opacity: 0.95, lineHeight: 1.45 }}>
                      Henüz görev eklemedin — önce bir görev ekle. 📝
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '44px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
                          {doneToday}
                        </span>
                        <span style={{ fontSize: '18px', fontWeight: 600, opacity: 0.85 }}>
                          / {totalToday} görev
                        </span>
                      </div>

                      {/* Beyaz ilerleme çubuğu — gradyan zeminde okunur */}
                      <div
                        style={{
                          height: '8px',
                          borderRadius: '999px',
                          background: 'rgba(255,255,255,0.28)',
                          overflow: 'hidden',
                          margin: '16px 0 6px',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${planProgress * 100}%`,
                            borderRadius: '999px',
                            background: '#fff',
                            transition: 'width 0.9s var(--ff-smooth)',
                          }}
                        />
                      </div>
                    </>
                  )}

                  {openTasks.length > 0 && (
                    <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {openTasks.slice(0, 3).map((t) => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '9px',
                            fontSize: '14px',
                            fontWeight: 500,
                            opacity: 0.95,
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: '#fff',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="ff-btn"
                    onClick={() => setShowPlan(true)}
                    style={{
                      marginTop: '18px',
                      background: 'rgba(255,255,255,0.95)',
                      color: '#d1481f',
                      boxShadow: '0 6px 18px rgba(0,0,0,0.14)',
                    }}
                  >
                    <IonIcon icon={sparklesOutline} style={{ fontSize: '19px' }} />
                    AI ile Günü Planla
                  </button>
                </div>
              </div>

              {/* İstatistikler */}
              <div
                className="ff-stat-grid ff-rise"
                style={{ marginTop: '14px', '--ff-delay': '0.1s' } as React.CSSProperties}
              >
                <div className="ff-stat">
                  <span className="ff-stat-icon ff-icon-mint">
                    <IonIcon icon={checkmarkDoneOutline} />
                  </span>
                  <span className="ff-stat-value">{data.tasks.completed_today}</span>
                  <span className="ff-stat-label">Tamamlanan Görev</span>
                </div>
                <div className="ff-stat">
                  <span className="ff-stat-icon ff-icon-cool">
                    <IonIcon icon={flashOutline} />
                  </span>
                  <span className="ff-stat-value">{data.focus.minutes_today} dk</span>
                  <span className="ff-stat-label">Bugün Odaklanma</span>
                </div>
                <div className="ff-stat">
                  <span className="ff-stat-icon ff-icon-primary">
                    <IonIcon icon={flameOutline} />
                  </span>
                  <span className="ff-stat-value">{data.user.streak_count}</span>
                  <span className="ff-stat-label">Günlük Seri</span>
                </div>
                <div className="ff-stat">
                  <span className="ff-stat-icon ff-icon-gold">
                    <IonIcon icon={trophyOutline} />
                  </span>
                  <span className="ff-stat-value">{data.user.total_xp}</span>
                  <span className="ff-stat-label">Toplam XP</span>
                </div>
              </div>

              {/* Seviye ilerlemesi */}
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
                    Seviye {data.user.level}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--ff-text-muted)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {xpIntoLevel} / {XP_PER_LEVEL} XP
                  </span>
                </div>
                <div className="ff-progress">
                  <div className="ff-progress-fill is-gold" style={{ width: `${levelProgress * 100}%` }} />
                </div>
                <p style={{ margin: '10px 0 0', fontSize: '13px', color: 'var(--ff-text-muted)' }}>
                  Sonraki seviyeye <strong style={{ color: 'var(--ff-text-soft)' }}>
                    {XP_PER_LEVEL - xpIntoLevel} XP
                  </strong> kaldı
                </p>
              </div>

              {/* Hızlı eylemler */}
              <div
                className="ff-rise"
                style={{ marginTop: '14px', '--ff-delay': '0.2s' } as React.CSSProperties}
              >
                <div className="ff-row ff-pressable" onClick={() => history.push('/analytics')}>
                  <span className="ff-stat-icon ff-icon-gold">
                    <IonIcon icon={statsChartOutline} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="ff-row-title">Detaylı İstatistikler</p>
                    <p className="ff-row-sub">
                      Ruh hali, odaklanma ve alışkanlık gelişimini incele.
                    </p>
                  </div>
                  <IonIcon icon={chevronForwardOutline} style={{ color: 'var(--ff-text-muted)' }} />
                </div>

                <div className="ff-row ff-pressable" onClick={() => setShowReflection(true)}>
                  <span
                    className={`ff-stat-icon ${todayReflection ? 'ff-icon-mint' : 'ff-icon-primary'}`}
                  >
                    <IonIcon icon={todayReflection ? checkmarkDoneOutline : journalOutline} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="ff-row-title">
                      {todayReflection ? 'Bugünü değerlendirdin' : 'Günlük Yansıma'}
                    </p>
                    <p className="ff-row-sub">
                      {todayReflection
                        ? 'Görüntüle veya düzenle'
                        : 'Günün nasıl geçti? Kısa bir değerlendirme yap.'}
                    </p>
                  </div>
                  <IonIcon icon={chevronForwardOutline} style={{ color: 'var(--ff-text-muted)' }} />
                </div>

                <div className="ff-row ff-pressable" onClick={() => setShowHabits(true)}>
                  <span className="ff-stat-icon ff-icon-cool">
                    <IonIcon icon={repeatOutline} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="ff-row-title">Alışkanlıklar</p>
                    <p className="ff-row-sub">Günlük alışkanlıklarını işaretle ve serini büyüt.</p>
                  </div>
                  <IonIcon icon={chevronForwardOutline} style={{ color: 'var(--ff-text-muted)' }} />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Günlük yansıma modalı */}
        <Reflection
          isOpen={showReflection}
          onClose={() => setShowReflection(false)}
          existing={todayReflection}
          onSaved={(r) => {
            setTodayReflection(r);
            loadDashboard(); // XP/veri güncellensin
          }}
        />

        {/* AI günlük plan modalı */}
        <DailyPlan isOpen={showPlan} onClose={() => setShowPlan(false)} openTaskCount={remaining} />

        {/* Alışkanlıklar modalı */}
        <Habits isOpen={showHabits} onClose={() => setShowHabits(false)} onChanged={loadDashboard} />
      </IonContent>
    </IonPage>
  );
};

export default Home;
