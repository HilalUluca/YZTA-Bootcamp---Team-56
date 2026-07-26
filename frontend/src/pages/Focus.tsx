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
  min === 25 ? 'Pomodoro 25' : min === 50 ? 'Pomodoro 50' : 'Özel seans';

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
  const [stats, setStats] = useState<any>(null);
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
    } catch (err) {
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
    } catch (err) {
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
        <div style={{ padding: '4px 18px 28px' }}>
          {/* Başlık */}
          <div className="ff-rise" style={{ margin: '6px 0 20px' }}>
            <h1 className="ff-title">Odaklan</h1>
            <p className="ff-subtitle">
              {isActive
                ? isRunning
                  ? 'Seans sürüyor — dikkatini dağıtma.'
                  : 'Seans duraklatıldı.'
                : 'Bir süre seç ve derin çalışmaya başla.'}
            </p>
          </div>

          {/* Görev seçimi */}
          <div
            className="ff-card ff-card-tight ff-rise"
            style={{ padding: '6px 16px', '--ff-delay': '0.05s' } as React.CSSProperties}
          >
            <IonItem
              lines="none"
              style={{
                '--background': 'transparent',
                '--padding-start': '0',
                '--inner-padding-end': '0',
                '--min-height': '52px',
              }}
            >
              <IonLabel
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--ff-text-muted)',
                  flex: '0 0 auto',
                  marginInlineEnd: '10px',
                }}
              >
                Görev
              </IonLabel>
              <IonSelect
                key={`task-select-${selectedTaskId}`}
                value={selectedTaskId}
                placeholder="Serbest odak"
                disabled={isActive}
                interface="action-sheet"
                onIonChange={(e) => setSelectedTaskId(e.detail.value)}
                style={{ fontWeight: 600, maxWidth: '100%' }}
              >
                <IonSelectOption value="">Serbest odak (görevsiz)</IonSelectOption>
                {tasks.map((t) => (
                  <IonSelectOption key={t.id} value={t.id}>
                    {t.title}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              className="ff-btn ff-btn-ghost ff-btn-auto"
              disabled={isActive}
              onClick={() => setShowNewTask(true)}
              style={{ fontSize: '13.5px', padding: '8px 14px' }}
            >
              <IonIcon icon={add} style={{ fontSize: '17px' }} />
              Yeni görev
            </button>
          </div>

          {/* Süre seçimi */}
          <div
            className="ff-segment ff-rise"
            style={{ marginTop: '14px', '--ff-delay': '0.1s' } as React.CSSProperties}
          >
            {DURATION_PRESETS.map((p) => (
              <button
                key={p}
                className={`ff-segment-btn ${!customMode && durationMin === p ? 'is-active' : ''}`}
                disabled={isActive}
                onClick={() => {
                  setCustomMode(false);
                  selectDuration(p);
                }}
              >
                {p} dk
              </button>
            ))}
            <button
              className={`ff-segment-btn ${customMode ? 'is-active' : ''}`}
              disabled={isActive}
              onClick={() => setCustomMode(true)}
            >
              Özel
            </button>
          </div>

          {customMode && (
            <IonItem className="ff-field" lines="none" style={{ marginTop: '12px' }}>
              <IonLabel position="stacked">Özel süre (dakika)</IonLabel>
              <IonInput
                type="number"
                value={durationMin}
                placeholder="Örn: 30"
                min={1}
                max={180}
                disabled={isActive}
                onIonInput={(e) => {
                  const v = parseInt(e.detail.value || '');
                  if (!isNaN(v) && v > 0) selectDuration(Math.min(v, 180));
                }}
              />
            </IonItem>
          )}

          {/* Seans türü etiketi */}
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <span className="ff-chip ff-chip-primary">
              {sessionTypeLabel(durationMin)} · {durationMin} dk
            </span>
          </div>

          {notifPermission === 'denied' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                marginTop: '10px',
                fontSize: '12px',
                color: 'var(--ff-text-muted)',
                textAlign: 'center',
              }}
            >
              <IonIcon icon={notificationsOffOutline} />
              Bildirim izni kapalı — süre bitince yalnızca ses ve uygulama içi uyarı gelir.
            </div>
          )}

          {/* TIMER — gradyan halkalı cam disk */}
          <div
            className="ff-rise"
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '26px 0 22px',
              '--ff-delay': '0.15s',
            } as React.CSSProperties}
          >
            <div style={{ position: 'relative', width: '292px', height: '292px' }}>
              {/* Arkadaki parlama — seans akarken nefes alır */}
              <div
                className={isRunning ? 'ff-pulse' : ''}
                style={{
                  position: 'absolute',
                  inset: '18px',
                  borderRadius: '50%',
                  background: 'var(--ff-grad-focus)',
                  filter: 'blur(38px)',
                  opacity: isRunning ? 0.42 : 0.2,
                  transition: 'opacity 0.6s ease',
                }}
              />

              {/* Cam disk */}
              <div
                style={{
                  position: 'absolute',
                  inset: '16px',
                  borderRadius: '50%',
                  background: 'var(--ff-glass-bg-strong)',
                  backdropFilter: 'var(--ff-glass-blur)',
                  WebkitBackdropFilter: 'var(--ff-glass-blur)',
                  border: '1px solid var(--ff-glass-border)',
                  boxShadow: 'var(--ff-shadow-lg)',
                }}
              />

              {/* İlerleme halkası */}
              <svg width="292" height="292" viewBox="0 0 292 292" style={{ position: 'relative' }}>
                <defs>
                  <linearGradient id="ffRing" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff8a3d" />
                    <stop offset="55%" stopColor="#ff5e62" />
                    <stop offset="100%" stopColor="#f0468a" />
                  </linearGradient>
                </defs>

                {/* Zemin halkası */}
                <circle
                  cx="146"
                  cy="146"
                  r={radius}
                  fill="none"
                  stroke="var(--ff-fill-soft)"
                  strokeWidth="12"
                />
                {/* Dolan halka */}
                <circle
                  cx="146"
                  cy="146"
                  r={radius}
                  fill="none"
                  stroke="url(#ffRing)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 146 146)"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>

              {/* Ortadaki süre */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    fontSize: '62px',
                    fontWeight: 800,
                    letterSpacing: '-0.045em',
                    lineHeight: 1,
                    color: 'var(--ff-text)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {mm}:{ss}
                </div>
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '13.5px',
                    fontWeight: 600,
                    color: 'var(--ff-text-muted)',
                  }}
                >
                  {isActive ? (isRunning ? 'Odaklan 💪' : 'Duraklatıldı') : 'Hazır olduğunda başla'}
                </div>
                {selectedTask && (
                  <div
                    style={{
                      marginTop: '6px',
                      maxWidth: '180px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--ff-text-soft)',
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedTask.title}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kontroller */}
          <div
            className="ff-rise"
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              '--ff-delay': '0.2s',
            } as React.CSSProperties}
          >
            <button className="ff-btn" onClick={handlePrimary}>
              <IonIcon icon={primaryIcon} style={{ fontSize: '19px' }} />
              {primaryLabel}
            </button>
            <button
              className="ff-btn ff-btn-ghost"
              onClick={handleReset}
              disabled={!isActive}
              aria-label="Sıfırla"
              style={{ width: '56px', flexShrink: 0, padding: '15px 0' }}
            >
              <IonIcon icon={refresh} style={{ fontSize: '20px' }} />
            </button>
          </div>

          {/* İstatistikler */}
          {stats && (
            <div
              className="ff-card ff-rise"
              style={{ marginTop: '18px', '--ff-delay': '0.25s' } as React.CSSProperties}
            >
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div className="ff-stat-value ff-grad-text">{stats.total_sessions}</div>
                  <div className="ff-stat-label">Seans</div>
                </div>
                <div>
                  <div className="ff-stat-value ff-grad-text">
                    {formatFocusTotal(stats.total_focus_minutes ?? 0)}
                  </div>
                  <div className="ff-stat-label">Toplam Odak</div>
                </div>
                <div>
                  <div className="ff-stat-value ff-grad-text">{stats.avg_productivity_rating}</div>
                  <div className="ff-stat-label">Ort. Puan</div>
                </div>
              </div>
            </div>
          )}
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
