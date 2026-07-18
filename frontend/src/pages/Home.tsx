import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonIcon,
  IonProgressBar,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonButton,
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
} from 'ionicons/icons';
import api from '../services/api';
import parrotImg from '../assets/parrot-login.png';
import Reflection, { ReflectionData } from './Reflection';
import DailyPlan from './DailyPlan';

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

const Home: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Günlük yansıma
  const [todayReflection, setTodayReflection] = useState<ReflectionData | null>(null);
  const [showReflection, setShowReflection] = useState<boolean>(false);

  // AI günlük plan
  const [showPlan, setShowPlan] = useState<boolean>(false);

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

  const name = data ? data.user.full_name || data.user.username : '';

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
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Ana Sayfa</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {/* Yükleniyor */}
        {isLoading && !data && (
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
            <IonSpinner name="crescent" color="primary" />
            <p style={{ color: 'var(--ion-color-medium)' }}>Yükleniyor...</p>
          </div>
        )}

        {/* Hata */}
        {error && !data && (
          <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--ion-color-danger)' }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '64px' }} />
            <h3>Bir sorun oluştu</h3>
            <p style={{ color: 'var(--ion-color-medium)' }}>{error}</p>
            <IonButton onClick={loadDashboard} fill="outline" color="danger">
              Tekrar Dene
            </IonButton>
          </div>
        )}

        {data && (
          <>
            {/* Karşılama + papağan */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '8px 0 20px 0' }}>
              <img
                src={parrotImg}
                alt="FocusForge papağanı"
                style={{ width: '72px', height: '72px', objectFit: 'contain', flexShrink: 0 }}
              />
              <div>
                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'var(--ion-text-color)' }}>
                  Merhaba, {name} 👋
                </h1>
                <p style={{ margin: '4px 0 0 0', color: 'var(--ion-color-medium)', fontSize: '14px' }}>
                  Bugün odaklanmak için harika bir gün 🚀
                </p>
              </div>
            </div>

            {/* Günün özeti kartları */}
            <IonGrid style={{ padding: 0 }}>
              <IonRow>
                <IonCol size="6">
                  <IonCard style={{ borderRadius: '16px', margin: '6px' }}>
                    <IonCardContent style={{ textAlign: 'center' }}>
                      <IonIcon icon={checkmarkDoneOutline} style={{ fontSize: '28px', color: 'var(--ion-color-tertiary)' }} />
                      <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>{data.tasks.completed_today}</h1>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Tamamlanan Görev</p>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
                <IonCol size="6">
                  <IonCard style={{ borderRadius: '16px', margin: '6px' }}>
                    <IonCardContent style={{ textAlign: 'center' }}>
                      <IonIcon icon={flashOutline} style={{ fontSize: '28px', color: 'var(--ion-color-secondary)' }} />
                      <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>{data.focus.minutes_today}dk</h1>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Bugün Odaklanma</p>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
              <IonRow>
                <IonCol size="6">
                  <IonCard style={{ borderRadius: '16px', margin: '6px' }}>
                    <IonCardContent style={{ textAlign: 'center' }}>
                      <IonIcon icon={flameOutline} style={{ fontSize: '28px', color: 'var(--ion-color-danger)' }} />
                      <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>{data.user.streak_count}</h1>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Günlük Seri</p>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
                <IonCol size="6">
                  <IonCard style={{ borderRadius: '16px', margin: '6px' }}>
                    <IonCardContent style={{ textAlign: 'center' }}>
                      <IonIcon icon={trophyOutline} style={{ fontSize: '28px', color: 'var(--ion-color-warning)' }} />
                      <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>{data.user.total_xp}</h1>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Toplam XP</p>
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
            </IonGrid>

            {/* Seviye ilerleme çubuğu */}
            <IonCard style={{ borderRadius: '16px', marginTop: '10px' }}>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                  <span>Seviye {data.user.level}</span>
                  <span style={{ color: 'var(--ion-color-medium)' }}>{xpIntoLevel} / {XP_PER_LEVEL} XP</span>
                </div>
                <IonProgressBar value={levelProgress} color="warning" style={{ height: '10px', borderRadius: '5px' }} />
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                  Sonraki seviyeye {XP_PER_LEVEL - xpIntoLevel} XP kaldı
                </p>
              </IonCardContent>
            </IonCard>

            {/* Bugünün planı */}
            <IonCard style={{ borderRadius: '16px', marginTop: '10px' }}>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Bugünün Planı</span>
                  <IonBadge color={remaining > 0 ? 'primary' : 'success'}>
                    {remaining > 0 ? `${remaining} görev kaldı` : 'Hepsi tamam 🎉'}
                  </IonBadge>
                </div>
                <IonProgressBar value={planProgress} color="primary" style={{ height: '10px', borderRadius: '5px' }} />
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                  {doneToday} / {totalToday} görev tamamlandı
                </p>

                {openTasks.length > 0 && (
                  <IonList style={{ marginTop: '12px', background: 'transparent' }}>
                    {openTasks.slice(0, 4).map((t) => (
                      <IonItem key={t.id} lines="full" style={{ '--background': 'transparent', '--padding-start': '0px' }}>
                        <IonLabel>
                          <h3 style={{ fontWeight: 500 }}>{t.title}</h3>
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                )}

                {/* AI ile günü planla — görev olsun olmasın HER ZAMAN görünür */}
                <IonButton
                  expand="block"
                  onClick={() => setShowPlan(true)}
                  style={{ marginTop: '16px', '--border-radius': '25px', fontWeight: 'bold' }}
                >
                  <IonIcon slot="start" icon={sparklesOutline} />
                  AI ile Günü Planla
                </IonButton>
              </IonCardContent>
            </IonCard>

            {/* Günlük Yansıma kartı — bugünün durumunu gösterir, modalı açar */}
            <IonCard
              button
              onClick={() => setShowReflection(true)}
              style={{ borderRadius: '16px', marginTop: '10px' }}
            >
              <IonCardContent>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IonIcon
                    icon={todayReflection ? checkmarkDoneOutline : journalOutline}
                    style={{ fontSize: '28px', color: todayReflection ? 'var(--ion-color-tertiary)' : 'var(--ion-color-primary)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold' }}>
                      {todayReflection ? 'Bugünü değerlendirdin ✓' : 'Günlük Yansıma'}
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                      {todayReflection ? 'Görüntüle veya düzenle' : 'Günün nasıl geçti? Kısa bir değerlendirme yap.'}
                    </p>
                  </div>
                  <IonIcon icon={chevronForwardOutline} style={{ color: 'var(--ion-color-medium)' }} />
                </div>
              </IonCardContent>
            </IonCard>
          </>
        )}

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
        <DailyPlan
          isOpen={showPlan}
          onClose={() => setShowPlan(false)}
          openTaskCount={remaining}
        />
      </IonContent>
    </IonPage>
  );
};

export default Home;
