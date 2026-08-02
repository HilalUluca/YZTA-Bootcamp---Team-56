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
  IonInput,
  IonIcon,
  IonModal,
  IonToast,
} from '@ionic/react';
import { play, pause, refresh, star, starOutline, add, notificationsOffOutline } from 'ionicons/icons';
import api from '../services/api';
import type { FocusStatsSummary } from '../services/types';
import forgeFocus from '../assets/focus-mascot-hd.png';
import focusLeaves from '../assets/hmsc/yellow-orange-branch.png';
import './Focus.css';
import {
  getNotificationPermission,
  notifySessionFinished,
  primeAudio,
  requestNotificationPermission,
  type NotificationPermissionState,
} from '../services/notifications';

interface Task {
  id: string;
  title: string;
  status: string;
}

// Süreyi backend'in SessionType enum'una çevirir (pomodoro_25 / pomodoro_50 / custom).
const sessionTypeFor = (min: number) =>
  min === 25 ? 'pomodoro_25' : min === 50 ? 'pomodoro_50' : 'custom';

// Aynı seçimin kullanıcıya gösterilen adı.
const sessionTypeLabel = (min: number) =>
  min === 15 ? 'Kısa odak' : min === 25 ? 'Pomodoro 25' : min === 50 ? 'Derin odak' : 'Özel seans';

// Toplam odaklanmayı okunur biçimde yazar. Saate yuvarlamak 59 dakikalık
// odaklanmayı "0s" gösterirdi, o yüzden 1 saatin altında dakika kullanıyoruz.
const formatFocusTotal = (minutes: number) =>
  minutes < 60 ? `${minutes}dk` : `${Math.round((minutes / 60) * 10) / 10}s`;

const Focus: React.FC = () => {
  // Seçimler
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [durationMin, setDurationMin] = useState<number>(25);
  const [customMode, setCustomMode] = useState<boolean>(false);
  const DURATION_PRESETS = [15, 25, 50];

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
  const [stats, setStats] = useState<FocusStatsSummary | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);

  // Sistem bildirimi izni ("granted" / "denied" / "default" / "unsupported")
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(
    () => getNotificationPermission()
  );

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Seansın biteceği an (epoch ms). Kalan süreyi her tick'te buradan
  // hesaplıyoruz; böylece sekme arka plana atılıp interval kısıtlansa bile
  // sayaç gerçek saatten şaşmıyor.
  const deadlineRef = useRef<number | null>(null);
  // Bitiş bildirimini seans başına yalnızca bir kez göndermek için kilit.
  const finishedRef = useRef<boolean>(false);

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
    } catch {
      // Görevler alınamazsa seçim boş kalır; serbest odak yine mümkün.
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/focus/stats/summary');
      setStats(res.data);
    } catch {
      setStats(null);
    }
  };

  // Sayaç: kalan süreyi saniye saymak yerine bitiş anından hesapla.
  // (Arka plandaki sekmede setInterval yavaşlatılır, bu yüzden "her tick'te
  // 1 azalt" yaklaşımı seansı olduğundan uzun gösterirdi.)
  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      if (deadlineRef.current === null) return;
      setSecondsLeft(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
    };

    tick();
    intervalRef.current = setInterval(tick, 500);
    // Uygulamaya geri dönüldüğünde kısıtlanmış interval'i beklemeden güncelle.
    document.addEventListener('visibilitychange', tick);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isRunning]);

  // Süre bittiğinde: sayacı durdur, kullanıcıyı uyar, değerlendirmeyi aç
  useEffect(() => {
    if (secondsLeft !== 0 || !isActive || finishedRef.current) return;

    finishedRef.current = true;
    deadlineRef.current = null;
    setIsRunning(false);
    setShowRating(true);
    // Ses + titreşim + sistem bildirimi (uygulama arka plandaysa da duyulur).
    void notifySessionFinished(durationMin);
  }, [secondsLeft, isActive, durationMin]);

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
    } catch {
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
        session_type: sessionTypeFor(durationMin),
        // planned_duration'ı gönderiyoruz; backend şu an saklamıyor ama zararsız.
        planned_duration: durationMin,
      });
      setSessionId(res.data.id);
      // Bitiş anını şimdiden sabitle: sayaç bundan sonra gerçek saati takip eder.
      deadlineRef.current = Date.now() + durationMin * 60 * 1000;
      finishedRef.current = false;
      setSecondsLeft(durationMin * 60);
      setIsActive(true);
      setIsRunning(true);
    } catch {
      notify('Seans başlatılamadı. Bağlantını kontrol et.');
    }
  };

  // Duraklat / Devam et: kalan süreyi koruyarak bitiş anını yeniden kur.
  const toggleRunning = () => {
    if (isRunning) {
      deadlineRef.current = null; // kalan süre dondu
      setIsRunning(false);
    } else {
      deadlineRef.current = Date.now() + secondsLeft * 1000;
      setIsRunning(true);
    }
  };

  // Başlat / Duraklat / Devam butonu
  const handlePrimary = () => {
    if (isActive) {
      toggleRunning();
      return;
    }
    // Bildirim izni ve ses hazırlığı kullanıcı tıklamasının içinde yapılmalı;
    // tarayıcılar bunları etkileşim dışında engelliyor.
    primeAudio();
    void requestNotificationPermission().then(setNotifPermission);
    startSession();
  };

  // Timer'ı baştan al (yalnızca yerel durum).
  const resetTimer = () => {
    deadlineRef.current = null;
    finishedRef.current = false;
    setIsRunning(false);
    setIsActive(false);
    setSessionId(null);
    setRatingValue(0);
    setSecondsLeft(durationMin * 60);
  };

  // Sıfırla butonu: yarım kalan seansı backend'den de sil, sonra timer'ı sıfırla.
  // Aksi halde vazgeçilen her seans "Seans" sayacını şişirirdi.
  const handleReset = async () => {
    const abandonedId = sessionId;
    resetTimer();
    if (!abandonedId) return;
    try {
      await api.delete(`/focus/${abandonedId}`);
    } catch {
      // Silinemezse istatistik biraz şişer ama kullanıcıyı burada rahatsız
      // etmiyoruz; backend zaten yarım seansları saymıyor.
    }
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
    } catch {
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
  const radius = 128;
  const circumference = 2 * Math.PI * radius;
  const remainingFraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const dashOffset = circumference * (1 - remainingFraction);

  const primaryLabel = !isActive ? 'Başlat' : isRunning ? 'Duraklat' : 'Devam Et';
  const primaryIcon = !isActive ? play : isRunning ? pause : play;

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <IonPage className="ff-page">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Odaklan</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="focus-shell">
          <section className="focus-intro ff-rise">
            <div>
              <span className="focus-eyebrow">ODAK MODU</span>
              <h1 className="ff-title">Şimdi odaklanma zamanı</h1>
              <p className="ff-subtitle">
                {isActive
                  ? isRunning
                    ? 'Seansın başladı. Şimdi sadece seçtiğin işe odaklan.'
                    : 'Seansın duraklatıldı, hazır olduğunda devam et.'
                  : 'Süreni ve görevini seç; gerisini Forge takip etsin.'}
              </p>
            </div>
          </section>

          <div className="focus-duration-tabs ff-rise">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset}
                className={!customMode && durationMin === preset ? 'is-active' : ''}
                disabled={isActive}
                onClick={() => {
                  setCustomMode(false);
                  selectDuration(preset);
                }}
              >
                <strong>{preset}</strong>
                <span>{preset === 15 ? 'Kısa' : preset === 25 ? 'Pomodoro' : 'Derin'}</span>
              </button>
            ))}
            <button
              className={customMode ? 'is-active' : ''}
              disabled={isActive}
              onClick={() => setCustomMode(true)}
            >
              <strong>+</strong>
              <span>Özel</span>
            </button>
          </div>

          {customMode && (
            <IonItem className="ff-field focus-custom-duration" lines="none">
              <IonLabel position="stacked">Özel süre (1–180 dakika)</IonLabel>
              <IonInput
                type="number"
                value={durationMin}
                placeholder="Örn: 30"
                min={1}
                max={180}
                disabled={isActive}
                onIonInput={(event) => {
                  const value = parseInt(event.detail.value || '');
                  if (!isNaN(value) && value > 0) selectDuration(Math.min(value, 180));
                }}
              />
            </IonItem>
          )}

          <section className={`focus-stage ff-rise${isRunning ? ' is-running' : ''}`}>
            <img className="focus-stage__leaves" src={focusLeaves} alt="" aria-hidden="true" />
            <div className="focus-stage__spark focus-stage__spark--one" />
            <div className="focus-stage__spark focus-stage__spark--two" />

            <div className="focus-task-row">
              <div className="focus-task-select">
                <span>Odak görevi</span>
                <IonSelect
                  key={`task-select-${selectedTaskId}`}
                  value={selectedTaskId}
                  placeholder="Serbest odak"
                  disabled={isActive}
                  interface="action-sheet"
                  onIonChange={(event) => setSelectedTaskId(event.detail.value)}
                >
                  <IonSelectOption value="">Serbest odak (görevsiz)</IonSelectOption>
                  {tasks.map((task) => (
                    <IonSelectOption key={task.id} value={task.id}>
                      {task.title}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </div>
              <button
                className="focus-add-task"
                disabled={isActive}
                onClick={() => setShowNewTask(true)}
                aria-label="Yeni görev ekle"
              >
                <IonIcon icon={add} />
              </button>
            </div>

            <div className="focus-session-chip">
              <span className="focus-session-chip__dot" />
              {sessionTypeLabel(durationMin)} · {durationMin} dk
            </div>

            <div className="focus-timer">
              <div className="focus-timer__glow" />
              <svg viewBox="0 0 292 292" aria-label={`${mm}:${ss} kaldı`}>
                <defs>
                  <linearGradient id="ffRing" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffb13b" />
                    <stop offset="48%" stopColor="#ff684f" />
                    <stop offset="100%" stopColor="#08a7a5" />
                  </linearGradient>
                </defs>
                <circle cx="146" cy="146" r={radius} className="focus-timer__track" />
                <circle
                  cx="146"
                  cy="146"
                  r={radius}
                  className="focus-timer__progress"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 146 146)"
                />
              </svg>
              <div className="focus-timer__content">
                <strong>{mm}:{ss}</strong>
                <span>{isActive ? (isRunning ? 'Odaklan' : 'Duraklatıldı') : 'Başlamaya hazır'}</span>
                {selectedTask && <small>{selectedTask.title}</small>}
              </div>
            </div>

            <div className="focus-mascot-wrap" aria-hidden="true">
              <img src={forgeFocus} alt="" />
            </div>
          </section>

          {notifPermission === 'denied' && (
            <div className="focus-notification-note">
              <IonIcon icon={notificationsOffOutline} />
              Bildirim izni kapalı; süre bitince uygulama içi uyarı ve ses kullanılacak.
            </div>
          )}

          <div className="focus-controls ff-rise">
            <button
              className="focus-reset-button"
              onClick={handleReset}
              disabled={!isActive}
              aria-label="Sayacı sıfırla"
            >
              <IonIcon icon={refresh} />
            </button>
            <button className="focus-primary-button" onClick={handlePrimary}>
              <IonIcon icon={primaryIcon} />
              {primaryLabel}
            </button>
          </div>

          <section className="focus-stats-card ff-rise">
            <div className="focus-stats-card__heading">
              <div>
                <span>ODAK ÖZETİN</span>
                <strong>{stats ? 'İlerlemen kaydediliyor' : 'İlk seansını tamamla'}</strong>
              </div>
              <span className="focus-stats-card__badge">Bu hafta</span>
            </div>
            <div className="focus-stats-grid">
              <div>
                <strong>{stats?.total_sessions ?? 0}</strong>
                <span>Seans</span>
              </div>
              <div>
                <strong>{formatFocusTotal(stats?.total_focus_minutes ?? 0)}</strong>
                <span>Toplam odak</span>
              </div>
              <div>
                <strong>{stats?.avg_productivity_rating ?? '–'}</strong>
                <span>Ort. puan</span>
              </div>
            </div>
          </section>
        </div>

        {/* Süre bitince: yıldızlı değerlendirme */}
        <IonModal isOpen={showRating} backdropDismiss={false}>
          <IonContent className="ff-page">
            <div className="ff-aurora" aria-hidden="true" />
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                textAlign: 'center',
                padding: '32px 26px',
              }}
            >
              <div
                className="ff-empty-icon ff-rise"
                style={{ width: '84px', height: '84px', fontSize: '40px' }}
              >
                🎉
              </div>
              <h1 className="ff-title ff-rise" style={{ marginTop: '18px' }}>
                Seans bitti!
              </h1>
              <p className="ff-subtitle ff-rise" style={{ marginBottom: '30px' }}>
                Bu odaklanma seansı nasıl geçti?
              </p>

              <div
                className="ff-rise"
                style={{ display: 'flex', gap: '10px', marginBottom: '34px' }}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <IonIcon
                    key={n}
                    icon={n <= ratingValue ? star : starOutline}
                    onClick={() => setRatingValue(n)}
                    style={{
                      fontSize: '38px',
                      color: n <= ratingValue ? '#ffb021' : 'var(--ff-text-muted)',
                      cursor: 'pointer',
                      transition: 'transform 0.32s var(--ff-spring)',
                      transform: n <= ratingValue ? 'scale(1.12)' : 'none',
                    }}
                  />
                ))}
              </div>

              <button
                className="ff-btn"
                disabled={ratingValue === 0}
                onClick={() => submitRating(ratingValue)}
                style={{ maxWidth: '340px' }}
              >
                Gönder
              </button>
            </div>
          </IonContent>
        </IonModal>

        {/* Hızlı yeni görev ekleme */}
        <IonModal
          isOpen={showNewTask}
          onDidDismiss={() => setShowNewTask(false)}
          initialBreakpoint={0.42}
          breakpoints={[0, 0.42]}
        >
          <IonContent className="ff-page">
            <div style={{ padding: '28px 22px' }}>
              <h2 className="ff-title" style={{ fontSize: '24px', marginBottom: '4px' }}>
                Yeni Görev
              </h2>
              <p className="ff-subtitle" style={{ marginBottom: '20px' }}>
                Odaklanacağın işi bir cümleyle yaz.
              </p>

              <IonItem className="ff-field" lines="none">
                <IonLabel position="stacked">Görev Başlığı</IonLabel>
                <IonInput
                  value={newTaskTitle}
                  placeholder="Örn: Rapor taslağını yaz"
                  onIonInput={(e) => setNewTaskTitle(e.detail.value!)}
                />
              </IonItem>

              <button
                className="ff-btn"
                disabled={!newTaskTitle.trim()}
                onClick={createTask}
                style={{ marginTop: '8px' }}
              >
                Kaydet ve Seç
              </button>
              <button
                className="ff-btn ff-btn-ghost"
                onClick={() => setShowNewTask(false)}
                style={{ marginTop: '10px' }}
              >
                İptal
              </button>
            </div>
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
