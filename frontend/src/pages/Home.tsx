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
  alertCircleOutline,
} from 'ionicons/icons';
import api from '../services/api';
import parrotWaveMascot from '../assets/hmsc/parrot-wave-mascot.png';
import parrotAvatar from '../assets/hmsc/circular-parrot-avatar.jpg';
import focusTimeIcon from '../assets/hmsc/focus-time-icon.jpg';
import dailyStreakIcon from '../assets/hmsc/daily-streak-icon.jpg';
import starIcon from '../assets/hmsc/star-icon.jpg';
import analyticsIcon from '../assets/hmsc/orange=statics-icon.jpg';
import reflectionIcon from '../assets/hmsc/coral-reflection-icon.jpg';
import habitsIcon from '../assets/hmsc/blue-habits-icon.jpg';
import chevronIcon from '../assets/hmsc/chevron-right-icon.jpg';
import sparkleIcon from '../assets/hmsc/sparkle-icon.jpg';
import planCardArtwork from '../assets/hmsc/plan-card.jpg';
import Reflection, { ReflectionData } from './Reflection';
import DailyPlan from './DailyPlan';
import Habits from './Habits';
import './Home.css';

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
    } catch {
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
    } catch {
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
  const rawName = data
    ? (data.user.full_name || '').trim().split(' ')[0] || data.user.username
    : '';
  const name = rawName
    ? rawName.charAt(0).toLocaleUpperCase('tr-TR') + rawName.slice(1)
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
    <IonPage className="ff-page home-page">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Ana Sayfa</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <main className="home-shell">
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
              <section className="home-welcome ff-rise" aria-labelledby="home-greeting">
                <div className="home-welcome-copy">
                  <p className="home-welcome-kicker">
                    {greetingFor(new Date().getHours())}
                  </p>
                  <h1 id="home-greeting" className="ff-title home-welcome-title">
                    {name} <span className="home-wave">👋</span>
                  </h1>
                  <p className="home-welcome-message">Bugün harika işler başarabilirsin!</p>
                </div>
                <div className="home-profile-avatar" aria-hidden="true">
                  <img src={parrotAvatar} alt="" />
                </div>
                <img
                  className="home-welcome-mascot"
                  src={parrotWaveMascot}
                  alt="El sallayan FocusForge maskotu Forge"
                />
              </section>

              {/* HERO — bugünün planı, günün ana eylemi */}
              <section
                className="ff-card-hero home-plan-card ff-rise"
                style={{ '--ff-delay': '0.05s' } as React.CSSProperties}
                aria-labelledby="home-plan-title"
              >
                <img className="home-plan-artwork" src={planCardArtwork} alt="" aria-hidden="true" />
                <div className="home-plan-content">
                  <div className="home-plan-heading">
                    <span id="home-plan-title" className="home-plan-title">
                      Bugünün Planı
                    </span>
                    <span className="home-plan-status">
                      {totalToday === 0
                        ? 'Görev yok'
                        : remaining > 0
                        ? `${remaining} görev kaldı`
                        : 'Hepsi tamam 🎉'}
                    </span>
                  </div>

                  {totalToday === 0 ? (
                    /* Hiç görev yok: sayı/çubuk yerine boş durum mesajı */
                    <div className="home-plan-empty">
                      Henüz görev eklemedin — önce bir görev ekle. 📝
                    </div>
                  ) : (
                    <>
                      <div className="home-plan-count">
                        <span className="home-plan-count-value">
                          {doneToday}
                        </span>
                        <span className="home-plan-count-total">
                          / {totalToday} görev
                        </span>
                      </div>

                      {/* Beyaz ilerleme çubuğu — gradyan zeminde okunur */}
                      <div className="home-plan-progress">
                        <div
                          className="home-plan-progress-fill"
                          style={{
                            width: `${planProgress * 100}%`,
                          }}
                        />
                      </div>
                    </>
                  )}

                  {openTasks.length > 0 && (
                    <div className="home-plan-tasks">
                      {openTasks.slice(0, 3).map((t) => (
                        <div key={t.id} className="home-plan-task">
                          <span className="home-plan-task-dot" />
                          <span className="home-plan-task-title">
                            {t.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    className="ff-btn home-plan-button"
                    onClick={() => setShowPlan(true)}
                  >
                    <img src={sparkleIcon} alt="" aria-hidden="true" />
                    AI ile Günü Planla
                  </button>
                </div>
              </section>

              {/* İstatistikler */}
              <div
                className="ff-stat-grid home-stat-grid ff-rise"
                style={{ '--ff-delay': '0.1s' } as React.CSSProperties}
              >
                <div className="ff-stat home-stat home-stat-completed">
                  <span className="ff-stat-icon ff-icon-mint">
                    <IonIcon icon={checkmarkDoneOutline} />
                  </span>
                  <span className="ff-stat-value">{data.tasks.completed_today}</span>
                  <span className="ff-stat-label">Tamamlanan Görev</span>
                </div>
                <div className="ff-stat home-stat home-stat-focus">
                  <img className="home-stat-asset" src={focusTimeIcon} alt="" aria-hidden="true" />
                  <span className="ff-stat-value">{data.focus.minutes_today} dk</span>
                  <span className="ff-stat-label">Bugün Odaklanma</span>
                </div>
                <div className="ff-stat home-stat home-stat-streak">
                  <img className="home-stat-asset" src={dailyStreakIcon} alt="" aria-hidden="true" />
                  <span className="ff-stat-value">{data.user.streak_count}</span>
                  <span className="ff-stat-label">Günlük Seri</span>
                </div>
                <div className="ff-stat home-stat home-stat-xp">
                  <img className="home-stat-asset" src={starIcon} alt="" aria-hidden="true" />
                  <span className="ff-stat-value">{data.user.total_xp}</span>
                  <span className="ff-stat-label">Toplam XP</span>
                </div>
              </div>

              {/* Seviye ilerlemesi */}
              <div
                className="ff-card home-level-card ff-rise"
                style={{ '--ff-delay': '0.15s' } as React.CSSProperties}
              >
                <div className="home-level-main">
                  <div className="home-level-content">
                    <div className="home-level-heading">
                      <span className="home-level-title">Seviye {data.user.level}</span>
                      <span className="home-level-xp">{xpIntoLevel} / {XP_PER_LEVEL} XP</span>
                    </div>
                    <div className="ff-progress">
                      <div className="ff-progress-fill is-gold" style={{ width: `${levelProgress * 100}%` }} />
                    </div>
                  </div>
                  <img className="home-level-avatar" src={parrotAvatar} alt="Forge maskotu" />
                </div>
                <p className="home-level-caption">
                  Sonraki seviyeye <strong>
                    {XP_PER_LEVEL - xpIntoLevel} XP
                  </strong> kaldı
                </p>
              </div>

              {/* Hızlı eylemler */}
              <div
                className="home-actions ff-rise"
                style={{ '--ff-delay': '0.2s' } as React.CSSProperties}
              >
                <div className="ff-row ff-pressable home-action" onClick={() => history.push('/analytics')}>
                  <img className="home-action-icon" src={analyticsIcon} alt="" aria-hidden="true" />
                  <div className="home-action-copy">
                    <p className="ff-row-title">Detaylı İstatistikler</p>
                    <p className="ff-row-sub">
                      Ruh hali, odaklanma ve alışkanlık gelişimini incele.
                    </p>
                  </div>
                  <img className="home-action-chevron" src={chevronIcon} alt="" aria-hidden="true" />
                </div>

                <div className="ff-row ff-pressable home-action" onClick={() => setShowReflection(true)}>
                  <span className={`home-action-icon-wrap ${todayReflection ? 'is-complete' : ''}`}>
                    {todayReflection ? (
                      <IonIcon icon={checkmarkDoneOutline} />
                    ) : (
                      <img className="home-action-icon" src={reflectionIcon} alt="" aria-hidden="true" />
                    )}
                  </span>
                  <div className="home-action-copy">
                    <p className="ff-row-title">
                      {todayReflection ? 'Bugünü değerlendirdin' : 'Günlük Yansıma'}
                    </p>
                    <p className="ff-row-sub">
                      {todayReflection
                        ? 'Görüntüle veya düzenle'
                        : 'Günün nasıl geçti? Kısa bir değerlendirme yap.'}
                    </p>
                  </div>
                  <img className="home-action-chevron" src={chevronIcon} alt="" aria-hidden="true" />
                </div>

                <div className="ff-row ff-pressable home-action" onClick={() => setShowHabits(true)}>
                  <img className="home-action-icon" src={habitsIcon} alt="" aria-hidden="true" />
                  <div className="home-action-copy">
                    <p className="ff-row-title">Alışkanlıklar</p>
                    <p className="ff-row-sub">Günlük alışkanlıklarını işaretle ve serini büyüt.</p>
                  </div>
                  <img className="home-action-chevron" src={chevronIcon} alt="" aria-hidden="true" />
                </div>
              </div>
            </>
          )}
        </main>

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
