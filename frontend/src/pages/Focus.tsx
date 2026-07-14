import React, { useState, useEffect, useRef } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonButton,
  IonButtons,
  IonInput,
  IonIcon,
  IonModal,
  IonText,
  IonToast,
  IonCard,
  IonCardContent,
} from '@ionic/react';
import { play, pause, refresh, star, starOutline, add } from 'ionicons/icons';
import api from '../services/api';

interface Task {
  id: string;
  title: string;
  status: string;
}

const Focus: React.FC = () => {
  // Seçimler
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [durationMin, setDurationMin] = useState<number>(25);

  // Timer durumu
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false); // sayaç akıyor mu
  const [isActive, setIsActive] = useState<boolean>(false); // seans başladı mı (backend'de kayıt var)
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Değerlendirme (yıldız) penceresi
  const [showRating, setShowRating] = useState<boolean>(false);
  const [ratingValue, setRatingValue] = useState<number>(0);

  // Yeni görev ekleme penceresi
  const [showNewTask, setShowNewTask] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');

  // İstatistik + bildirim
  const [stats, setStats] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  // Açılışta açık görevleri ve istatistikleri yükle
  useEffect(() => {
    loadTasks();
    loadStats();
  }, []);

  const loadTasks = async () => {
    try {
      const res = await api.get('/tasks/');
      // Sadece tamamlanmamış görevleri seçime sun
      setTasks((res.data.tasks || []).filter((t: Task) => t.status !== 'done'));
    } catch (err) {
      // Görevler alınamazsa seçim boş kalır; serbest odak yine mümkün.
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/focus/stats/summary');
      setStats(res.data);
    } catch (err) {
      setStats(null);
    }
  };

  // Sayaç: isRunning true iken her saniye bir azalt
  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Süre bittiğinde: sayacı durdur ve değerlendirme penceresini aç
  useEffect(() => {
    if (secondsLeft === 0 && isActive) {
      setIsRunning(false);
      setShowRating(true);
    }
  }, [secondsLeft, isActive]);

  // Yeni görev oluştur ve otomatik seç: POST /tasks/
  const createTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const res = await api.post('/tasks/', { title: newTaskTitle.trim() });
      const newTask: Task = { id: res.data.id, title: res.data.title, status: res.data.status };
      // Yeni görevi listeye ekle ve seç. IonSelect'in key'i değişince
      // yeniden mount olur ve doğru başlığı gösterir (aşağıya bak).
      setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
      setSelectedTaskId(newTask.id);
      setNewTaskTitle('');
      setShowNewTask(false);
      notify('Görev oluşturuldu ✅ Artık seansa başlayabilirsin.');
    } catch (err) {
      notify('Görev oluşturulamadı. Lütfen tekrar dene.');
    }
  };

  // Süre seçimi (sadece seans başlamadan önce değiştirilebilir)
  const selectDuration = (min: number) => {
    if (isActive) return;
    setDurationMin(min);
    setSecondsLeft(min * 60);
  };

  // Seansı başlat: POST /focus/start
  const startSession = async () => {
    try {
      const res = await api.post('/focus/start', {
        task_id: selectedTaskId || undefined,
        session_type: durationMin === 50 ? 'pomodoro_50' : 'pomodoro_25',
      });
      setSessionId(res.data.id);
      setIsActive(true);
      setIsRunning(true);
    } catch (err) {
      notify('Seans başlatılamadı. Bağlantını kontrol et.');
    }
  };

  // Başlat / Duraklat / Devam butonu
  const handlePrimary = () => {
    if (!isActive) {
      startSession();
    } else {
      setIsRunning((prev) => !prev);
    }
  };

  // Sıfırla: timer'ı baştan al (backend seansı yarım kalır)
  const resetTimer = () => {
    setIsRunning(false);
    setIsActive(false);
    setSessionId(null);
    setRatingValue(0);
    setSecondsLeft(durationMin * 60);
  };

  // Değerlendirmeyi gönder: PATCH /focus/{id}/end
  const submitRating = async (rating: number) => {
    if (!sessionId) {
      setShowRating(false);
      resetTimer();
      return;
    }
    try {
      await api.patch(`/focus/${sessionId}/end`, { productivity_rating: rating });
      notify('Harika iş! Seans kaydedildi 🎉');
      await loadStats();
    } catch (err) {
      notify('Seans kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setShowRating(false);
      resetTimer();
    }
  };

  // MM:SS biçimi
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  // Dairesel ilerleme halkası hesapları
  const totalSeconds = durationMin * 60;
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const remainingFraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const dashOffset = circumference * (1 - remainingFraction);

  const primaryLabel = !isActive ? 'Başlat' : isRunning ? 'Duraklat' : 'Devam Et';
  const primaryIcon = !isActive ? play : isRunning ? pause : play;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Odaklan</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        {/* Görev ve süre seçimi */}
        <IonItem lines="full" style={{ marginBottom: '8px', borderRadius: '12px' }}>
          <IonLabel position="stacked">Görev (opsiyonel)</IonLabel>
          <IonSelect
            key={`task-select-${selectedTaskId}`}
            value={selectedTaskId}
            placeholder="Serbest odak"
            disabled={isActive}
            onIonChange={(e) => setSelectedTaskId(e.detail.value)}
          >
            <IonSelectOption value="">Serbest odak (görevsiz)</IonSelectOption>
            {tasks.map((t) => (
              <IonSelectOption key={t.id} value={t.id}>
                {t.title}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        {/* Listede olmayan bir göreve odaklanmak için hızlı ekleme */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <IonButton
            fill="clear"
            size="small"
            disabled={isActive}
            onClick={() => setShowNewTask(true)}
          >
            <IonIcon slot="start" icon={add} />
            Yeni görev
          </IonButton>
        </div>

        <IonSegment
          value={String(durationMin)}
          disabled={isActive}
          onIonChange={(e) => selectDuration(parseInt(e.detail.value as string))}
          style={{ marginBottom: '24px' }}
        >
          <IonSegmentButton value="25">
            <IonLabel>25 dakika</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="50">
            <IonLabel>50 dakika</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {/* Büyük daire timer */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ position: 'relative', width: '260px', height: '260px' }}>
            <svg width="260" height="260" viewBox="0 0 260 260">
              {/* Arka plan halkası */}
              <circle
                cx="130"
                cy="130"
                r={radius}
                fill="none"
                stroke="rgba(var(--ion-color-primary-rgb), 0.15)"
                strokeWidth="16"
              />
              {/* İlerleme halkası (turuncu) */}
              <circle
                cx="130"
                cy="130"
                r={radius}
                fill="none"
                stroke="var(--ion-color-primary)"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 130 130)"
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            {/* Ortadaki süre yazısı */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: '52px', fontWeight: 800, color: 'var(--ion-text-color)', lineHeight: 1 }}>
                {mm}:{ss}
              </div>
              <div style={{ fontSize: '14px', color: 'var(--ion-color-medium)', marginTop: '6px' }}>
                {isActive ? (isRunning ? 'Odaklan 💪' : 'Duraklatıldı') : 'Hazır olduğunda başla'}
              </div>
            </div>
          </div>
        </div>

        {/* Butonlar */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
          <IonButton
            onClick={handlePrimary}
            style={{ '--border-radius': '25px', minWidth: '150px', height: '50px', fontWeight: 'bold' }}
          >
            <IonIcon slot="start" icon={primaryIcon} />
            {primaryLabel}
          </IonButton>
          <IonButton
            onClick={resetTimer}
            fill="outline"
            color="medium"
            disabled={!isActive}
            style={{ '--border-radius': '25px', height: '50px' }}
          >
            <IonIcon slot="icon-only" icon={refresh} />
          </IonButton>
        </div>

        {/* Odaklanma istatistikleri */}
        {stats && (
          <IonCard style={{ borderRadius: '16px' }}>
            <IonCardContent>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--ion-color-primary)' }}>
                    {stats.total_sessions}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>Seans</div>
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--ion-color-secondary)' }}>
                    {stats.total_focus_hours}s
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>Toplam Odak</div>
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--ion-color-tertiary)' }}>
                    {stats.avg_productivity_rating}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>Ort. Puan</div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Süre bitince: yıldızlı değerlendirme penceresi */}
        <IonModal isOpen={showRating} backdropDismiss={false}>
          <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                textAlign: 'center',
              }}
            >
              <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ion-color-primary)', marginBottom: '4px' }}>
                Seans bitti! 🎉
              </h1>
              <IonText color="medium" style={{ marginBottom: '24px' }}>
                Bu odaklanma seansı nasıl geçti?
              </IonText>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <IonIcon
                    key={n}
                    icon={n <= ratingValue ? star : starOutline}
                    onClick={() => setRatingValue(n)}
                    style={{ fontSize: '40px', color: 'var(--ion-color-warning)', cursor: 'pointer' }}
                  />
                ))}
              </div>

              <IonButton
                expand="block"
                disabled={ratingValue === 0}
                onClick={() => submitRating(ratingValue)}
                style={{ width: '100%', '--border-radius': '25px', height: '50px', fontWeight: 'bold' }}
              >
                Gönder
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        {/* Hızlı yeni görev ekleme penceresi */}
        <IonModal
          isOpen={showNewTask}
          onDidDismiss={() => setShowNewTask(false)}
          initialBreakpoint={0.4}
          breakpoints={[0, 0.4]}
        >
          <IonHeader>
            <IonToolbar color="primary">
              <IonButtons slot="start">
                <IonButton onClick={() => setShowNewTask(false)}>İptal</IonButton>
              </IonButtons>
              <IonTitle>Yeni Görev</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
            <IonItem style={{ marginBottom: '20px', borderRadius: '12px' }}>
              <IonLabel position="stacked">Görev Başlığı</IonLabel>
              <IonInput
                value={newTaskTitle}
                placeholder="Örn: Rapor taslağını yaz"
                onIonInput={(e) => setNewTaskTitle(e.detail.value!)}
              />
            </IonItem>
            <IonButton
              expand="block"
              disabled={!newTaskTitle.trim()}
              onClick={createTask}
              style={{ '--border-radius': '25px', height: '50px', fontWeight: 'bold' }}
            >
              Kaydet ve Seç
            </IonButton>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2500}
        />
      </IonContent>
    </IonPage>
  );
};

export default Focus;
