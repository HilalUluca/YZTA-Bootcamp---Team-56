import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonCheckbox,
  IonFab,
  IonFabButton,
  IonIcon,
  IonModal,
  IonButton,
  IonButtons,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonRefresher,
  IonRefresherContent,
  IonToast,
  IonSpinner,
} from '@ionic/react';
import {
  add,
  alertCircleOutline,
  hourglassOutline,
  flameOutline,
  trophyOutline,
  flashOutline,
  statsChartOutline,
  trashOutline,
  calendarOutline,
  gitBranchOutline,
  checkboxOutline,
} from 'ionicons/icons';
import api from '../services/api';
import EisenhowerMatrix from './EisenhowerMatrix';
import TaskDetail, { DetailTask } from './TaskDetail';
import './Tab1.css';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  estimated_minutes?: number;
  due_date?: string | null;
  parent_task_id?: string | null;
}

interface DashboardData {
  user: {
    username: string;
    full_name: string;
    level: number;
    total_xp: number;
    streak_count: number;
  };
  tasks: {
    total: number;
    open: number;
    completed_today: number;
    overdue: number;
    todays_list: Task[];
  };
  focus: {
    minutes_today: number;
    sessions_today: number;
    total_minutes: number;
    total_hours: number;
  };
  score: {
    value: number;
    level: string;
    coach_tone: string;
  };
}

// Öncelik → etiket metni ve çip rengi.
const PRIORITY_CHIP: Record<string, { label: string; cls: string }> = {
  urgent_important: { label: 'Acil & Önemli', cls: 'ff-chip-danger' },
  important: { label: 'Önemli', cls: 'ff-chip-warn' },
  urgent: { label: 'Acil', cls: 'ff-chip-cool' },
  low: { label: 'Düşük Öncelik', cls: '' },
};

const Tab1: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list'); // liste / Eisenhower matrisi
  const [showModal, setShowModal] = useState(false);

  // Görev detay modalı
  const [detailTask, setDetailTask] = useState<DetailTask | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Yeni görev formu
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('low');
  const [estMinutes, setEstMinutes] = useState<number | undefined>(undefined);

  // Kısa bildirim (toast) göstermek için yardımcı
  const notify = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  // Görev listesini backend'den çek (ana kaynak): GET /tasks/
  const loadTasks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/tasks/');
      setTasks(res.data.tasks || []);
    } catch (err) {
      // Sahte veri göstermiyoruz; kullanıcıya net hata veriyoruz.
      setError('Görevler yüklenemedi. Sunucu bağlantını kontrol edip tekrar dene.');
    } finally {
      setIsLoading(false);
    }
  };

  // Üstteki istatistik kartları için opsiyonel dashboard verisi
  const loadDashboard = async () => {
    try {
      const res = await api.get('/stats/dashboard');
      setDashboard(res.data);
    } catch (err) {
      // Dashboard gelmezse kartları gizle; uydurma veri gösterme.
      setDashboard(null);
    }
  };

  useEffect(() => {
    loadTasks();
    loadDashboard();
  }, []);

  const handleRefresh = async (event: CustomEvent) => {
    await Promise.all([loadTasks(), loadDashboard()]);
    event.detail.complete();
  };

  // Görevi tamamla / geri al (kutucuğa her tıklamada durum değişir)
  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'done') {
        // Geri al: PUT /tasks/{id} ile durumu "todo"ya çevir
        await api.put(`/tasks/${taskId}`, { status: 'todo' });
        notify('Görev geri alındı ↩️');
      } else {
        // Tamamla: PATCH /tasks/{id}/complete
        await api.patch(`/tasks/${taskId}/complete`);
        notify('Görev tamamlandı! 🎉');
      }
      await Promise.all([loadTasks(), loadDashboard()]);
    } catch (err) {
      notify('İşlem başarısız. Lütfen tekrar dene.');
    }
  };

  // Yeni görev ekle: POST /tasks/
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api.post('/tasks/', {
        title,
        description: description || undefined,
        priority,
        estimated_minutes: estMinutes || undefined,
      });
      notify('Görev eklendi ✅');
      // Formu temizle ve kapat
      setTitle('');
      setDescription('');
      setPriority('low');
      setEstMinutes(undefined);
      setShowModal(false);
      await Promise.all([loadTasks(), loadDashboard()]);
    } catch (err) {
      // Sahte ekleme yok; modal açık kalır ki kullanıcı tekrar deneyebilsin.
      notify('Görev eklenemedi. Lütfen tekrar dene.');
    }
  };

  // Görevi sil: DELETE /tasks/{id}
  const handleDeleteTask = async (taskId: string) => {
    try {
      await api.delete(`/tasks/${taskId}`);
      notify('Görev silindi 🗑️');
      await Promise.all([loadTasks(), loadDashboard()]);
    } catch (err) {
      notify('Görev silinemedi. Lütfen tekrar dene.');
    }
  };

  // Deadline çipini hazırlar: gecikmiş / bugün / yarın / tarih
  const getDueInfo = (iso: string, isDone: boolean) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const gunBasi = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const farkGun = Math.round((gunBasi(d) - gunBasi(new Date())) / 86400000);
    const tarihYazi = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

    // Tamamlanmış görevde "gecikti" uyarısı göstermeye gerek yok
    if (isDone) return { label: tarihYazi, cls: '' };
    if (farkGun < 0) return { label: `${Math.abs(farkGun)} gün gecikti`, cls: 'ff-chip-danger' };
    if (farkGun === 0) return { label: 'Bugün', cls: 'ff-chip-warn' };
    if (farkGun === 1) return { label: 'Yarın', cls: 'ff-chip-warn' };
    return { label: tarihYazi, cls: '' };
  };

  // Alt görev sayıları: hangi görevin kaç alt görevi var?
  // Backend ayrı bir alan döndürmüyor; listedeki parent_task_id'lerden türetiyoruz.
  const subtaskCounts: Record<string, number> = {};
  tasks.forEach((t) => {
    if (t.parent_task_id) {
      subtaskCounts[t.parent_task_id] = (subtaskCounts[t.parent_task_id] || 0) + 1;
    }
  });

  const openCount = dashboard ? dashboard.tasks.open : tasks.filter((t) => t.status !== 'done').length;

  return (
    <IonPage className="ff-page">
      <IonHeader>
        <IonToolbar>
          <IonTitle>Görevler</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: '4px 18px 28px' }}>
          {/* Başlık */}
          <div className="ff-rise" style={{ margin: '6px 0 20px' }}>
            <h1 className="ff-title">Görevler</h1>
            <p className="ff-subtitle">
              {openCount > 0 ? `${openCount} açık görevin var` : 'Bütün görevlerin tamam 🎉'}
            </p>
          </div>

          {/* İstatistikler */}
          {dashboard && (
            <div
              className="ff-stat-grid ff-rise"
              style={{ '--ff-delay': '0.05s' } as React.CSSProperties}
            >
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-gold">
                  <IonIcon icon={trophyOutline} />
                </span>
                <span className="ff-stat-value">Lvl {dashboard.user.level}</span>
                <span className="ff-stat-label">{dashboard.user.total_xp} XP</span>
              </div>
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-primary">
                  <IonIcon icon={flameOutline} />
                </span>
                <span className="ff-stat-value">{dashboard.user.streak_count}</span>
                <span className="ff-stat-label">Günlük Seri</span>
              </div>
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-cool">
                  <IonIcon icon={flashOutline} />
                </span>
                <span className="ff-stat-value">{dashboard.focus.minutes_today} dk</span>
                <span className="ff-stat-label">Bugün Odaklanma</span>
              </div>
              <div className="ff-stat">
                <span className="ff-stat-icon ff-icon-mint">
                  <IonIcon icon={statsChartOutline} />
                </span>
                <span className="ff-stat-value">{dashboard.score.value}</span>
                <span className="ff-stat-label">Skor / 100</span>
              </div>
            </div>
          )}

          {/* Durum çipleri */}
          {dashboard && (
            <div
              className="ff-rise"
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: '14px',
                '--ff-delay': '0.1s',
              } as React.CSSProperties}
            >
              <span className="ff-chip ff-chip-primary">Açık {dashboard.tasks.open}</span>
              <span className="ff-chip ff-chip-mint">
                Bugün {dashboard.tasks.completed_today} ✓
              </span>
              {dashboard.tasks.overdue > 0 && (
                <span className="ff-chip ff-chip-danger">
                  Gecikmiş {dashboard.tasks.overdue}
                </span>
              )}
            </div>
          )}

          {/* Görünüm değiştirme: Liste / Eisenhower matrisi */}
          <div
            className="ff-segment ff-rise"
            style={{ marginTop: '20px', '--ff-delay': '0.15s' } as React.CSSProperties}
          >
            <button
              type="button"
              className={`ff-segment-btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              Liste
            </button>
            <button
              type="button"
              className={`ff-segment-btn ${viewMode === 'matrix' ? 'is-active' : ''}`}
              onClick={() => setViewMode('matrix')}
            >
              Matris
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            {viewMode === 'matrix' ? (
              <EisenhowerMatrix />
            ) : isLoading && tasks.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '48px' }}>
                <IonSpinner name="crescent" color="primary" />
                <p className="ff-subtitle">Yükleniyor...</p>
              </div>
            ) : error ? (
              <div className="ff-empty ff-rise">
                <span className="ff-empty-icon">
                  <IonIcon icon={alertCircleOutline} />
                </span>
                <h3 className="ff-title" style={{ fontSize: '22px' }}>Bir sorun oluştu</h3>
                <p className="ff-subtitle">{error}</p>
                <button className="ff-btn ff-btn-ghost ff-btn-auto" onClick={loadTasks}>
                  Tekrar Dene
                </button>
              </div>
            ) : tasks.length === 0 ? (
              <div className="ff-empty ff-rise">
                <span className="ff-empty-icon">
                  <IonIcon icon={checkboxOutline} />
                </span>
                <h3 className="ff-title" style={{ fontSize: '22px' }}>Henüz görevin yok</h3>
                <p className="ff-subtitle">
                  Sağ alttaki “+” butonuyla ilk görevini ekleyebilirsin.
                </p>
              </div>
            ) : (
              tasks.map((task, i) => {
                const isDone = task.status === 'done';
                const prio = PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.low;
                const due = task.due_date ? getDueInfo(task.due_date, isDone) : null;
                const subCount = subtaskCounts[task.id] || 0;

                return (
                  <IonItemSliding key={task.id}>
                    <IonItem className="ff-item" lines="none">
                      <div
                        className={`ff-row ff-row-full ff-rise ${isDone ? 'is-done' : ''}`}
                        style={{ '--ff-delay': `${0.2 + i * 0.04}s` } as React.CSSProperties}
                      >
                        <IonCheckbox
                          checked={isDone}
                          onIonChange={() => handleToggleComplete(task.id, task.status)}
                          style={{ marginTop: '2px', flexShrink: 0 }}
                        />

                        <div
                          style={{ flex: 1, minWidth: 0 }}
                          onClick={() => {
                            setDetailTask(task);
                            setShowDetail(true);
                          }}
                        >
                          {/* Bu görev bir alt görevse belli olsun */}
                          {task.parent_task_id && (
                            <p className="ff-row-sub" style={{ margin: '0 0 3px' }}>
                              ↳ alt görev
                            </p>
                          )}

                          <p className="ff-row-title">{task.title}</p>

                          {task.description && (
                            <p className="ff-row-sub">{task.description}</p>
                          )}

                          <div
                            style={{
                              display: 'flex',
                              gap: '6px',
                              flexWrap: 'wrap',
                              marginTop: '10px',
                            }}
                          >
                            <span className={`ff-chip ${prio.cls}`}>{prio.label}</span>

                            {due && (
                              <span className={`ff-chip ${due.cls}`}>
                                <IonIcon icon={calendarOutline} />
                                {due.label}
                              </span>
                            )}

                            {subCount > 0 && (
                              <span className="ff-chip ff-chip-cool">
                                <IonIcon icon={gitBranchOutline} />
                                {subCount} alt görev
                              </span>
                            )}

                            {task.estimated_minutes && (
                              <span className="ff-chip">
                                <IonIcon icon={hourglassOutline} />
                                {task.estimated_minutes} dk
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </IonItem>

                    <IonItemOptions side="end">
                      <IonItemOption onClick={() => handleDeleteTask(task.id)}>
                        <IonIcon slot="icon-only" icon={trashOutline} />
                      </IonItemOption>
                    </IonItemOptions>
                  </IonItemSliding>
                );
              })
            )}
          </div>
        </div>

        {/* Görev Ekleme Floating Butonu */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton onClick={() => setShowModal(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        {/* Yeni Görev Modalı */}
        <IonModal isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
          <IonHeader>
            <IonToolbar color="primary">
              <IonButtons slot="start">
                <IonButton onClick={() => setShowModal(false)}>İptal</IonButton>
              </IonButtons>
              <IonTitle>Yeni Görev Ekle</IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            <form onSubmit={handleAddTask}>
              <IonItem className="ff-field" lines="none">
                <IonLabel position="stacked">Görev Başlığı *</IonLabel>
                <IonInput
                  required
                  value={title}
                  placeholder="Örn: SQL Ödevi Hazırla"
                  onIonInput={(e) => setTitle(e.detail.value!)}
                />
              </IonItem>

              <IonItem className="ff-field" lines="none">
                <IonLabel position="stacked">Açıklama</IonLabel>
                <IonTextarea
                  value={description}
                  placeholder="Göreve dair detaylar..."
                  autoGrow
                  onIonInput={(e) => setDescription(e.detail.value!)}
                />
              </IonItem>

              <IonItem className="ff-field" lines="none">
                <IonLabel position="stacked">Öncelik</IonLabel>
                <IonSelect value={priority} onIonChange={(e) => setPriority(e.detail.value)}>
                  <IonSelectOption value="urgent_important">Acil & Önemli (Hemen Yap)</IonSelectOption>
                  <IonSelectOption value="important">Önemli (Planla)</IonSelectOption>
                  <IonSelectOption value="urgent">Acil (Delege Et)</IonSelectOption>
                  <IonSelectOption value="low">Düşük Öncelik (Ertele)</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem className="ff-field" lines="none" style={{ marginBottom: '24px' }}>
                <IonLabel position="stacked">Tahmini Süre (Dakika)</IonLabel>
                <IonInput
                  type="number"
                  value={estMinutes}
                  placeholder="Örn: 45"
                  onIonInput={(e) =>
                    setEstMinutes(e.detail.value ? parseInt(e.detail.value) : undefined)
                  }
                />
              </IonItem>

              <button className="ff-btn" type="submit">
                Görevi Kaydet
              </button>
            </form>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
        />

        {/* Görev detay modalı */}
        <TaskDetail
          isOpen={showDetail}
          task={detailTask}
          onClose={() => setShowDetail(false)}
          onChanged={() => {
            loadTasks();
            loadDashboard();
          }}
        />
      </IonContent>
    </IonPage>
  );
};

export default Tab1;
