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
  trashOutline,
  calendarOutline,
  gitBranchOutline,
  checkboxOutline,
  checkmarkCircleOutline,
  timeOutline,
  warningOutline,
} from 'ionicons/icons';
import api from '../services/api';
import EisenhowerMatrix from './EisenhowerMatrix';
import TaskDetail, { DetailTask } from './TaskDetail';
import forgeHappy from '../assets/forge-happy.png';
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

const PRIORITY_GROUPS = [
  { key: 'urgent_important', title: 'Önce bunları tamamla', hint: 'Acil ve önemli', tone: 'danger' },
  { key: 'important', title: 'Planına yerleştir', hint: 'Önemli', tone: 'warning' },
  { key: 'urgent', title: 'Hızlıca sonuçlandır', hint: 'Acil', tone: 'cool' },
  { key: 'low', title: 'Vaktin kalırsa', hint: 'Düşük öncelik', tone: 'mint' },
] as const;

type StatusFilter = 'open' | 'done' | 'all';

const Tab1: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list'); // liste / Eisenhower matrisi
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [priorityFilter, setPriorityFilter] = useState('all');
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const overdueCount = dashboard?.tasks.overdue ?? tasks.filter((t) => {
    if (t.status === 'done' || !t.due_date) return false;
    return new Date(t.due_date).getTime() < new Date().setHours(0, 0, 0, 0);
  }).length;

  const filteredTasks = tasks
    .filter((task) => {
      if (statusFilter === 'open' && task.status === 'done') return false;
      if (statusFilter === 'done' && task.status !== 'done') return false;
      return priorityFilter === 'all' || task.priority === priorityFilter;
    })
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

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

        <div className="tasks-page-shell">
          <section className="tasks-heading ff-rise">
            <div>
              <span className="tasks-eyebrow">GÜNLÜK PLANIN</span>
              <h1 className="ff-title">Görevler</h1>
              <p className="ff-subtitle">
                {openCount > 0 ? `${openCount} açık görevini önceliğine göre sırala.` : 'Harika, bütün görevlerin tamam!'}
              </p>
            </div>
          </section>

          <section className="tasks-summary ff-rise" style={{ '--ff-delay': '0.05s' } as React.CSSProperties}>
            <div className="tasks-summary-item is-open">
              <IonIcon icon={timeOutline} />
              <span><strong>{openCount}</strong>Açık</span>
            </div>
            <div className="tasks-summary-item is-done">
              <IonIcon icon={checkmarkCircleOutline} />
              <span><strong>{dashboard?.tasks.completed_today ?? completedCount}</strong>Bugün bitti</span>
            </div>
            <div className="tasks-summary-item is-overdue">
              <IonIcon icon={warningOutline} />
              <span><strong>{overdueCount}</strong>Geciken</span>
            </div>
          </section>

          <div className="ff-segment tasks-view-switch ff-rise" style={{ '--ff-delay': '0.1s' } as React.CSSProperties}>
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

          <div className="tasks-content">
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
              <>
                <div className="tasks-status-tabs" role="tablist" aria-label="Görev durumu">
                  {([
                    ['open', 'Açık'],
                    ['done', 'Tamamlanan'],
                    ['all', 'Tümü'],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" className={statusFilter === key ? 'is-active' : ''} onClick={() => setStatusFilter(key)}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="tasks-priority-filters" aria-label="Öncelik filtresi">
                  <button type="button" className={priorityFilter === 'all' ? 'is-active' : ''} onClick={() => setPriorityFilter('all')}>Tümü</button>
                  {PRIORITY_GROUPS.map((group) => (
                    <button key={group.key} type="button" className={`${priorityFilter === group.key ? 'is-active' : ''} is-${group.tone}`} onClick={() => setPriorityFilter(group.key)}>
                      {group.hint}
                    </button>
                  ))}
                </div>

                <aside className="tasks-forge-tip ff-rise">
                  <div>
                    <span>FORGE'UN ÖNERİSİ</span>
                    <strong>{overdueCount > 0 ? 'Önce geciken görevlere odaklan.' : 'En önemli görevini günün erken saatinde tamamla.'}</strong>
                  </div>
                  <img src={forgeHappy} alt="Mutlu Forge maskotu" />
                </aside>

                {filteredTasks.length === 0 ? (
                  <div className="tasks-filter-empty">
                    <IonIcon icon={checkmarkCircleOutline} />
                    <strong>Bu filtrede görev yok</strong>
                    <span>Başka bir durum veya öncelik seçebilirsin.</span>
                  </div>
                ) : (
                  PRIORITY_GROUPS.map((group) => {
                    const groupTasks = filteredTasks.filter((task) => task.priority === group.key || (group.key === 'low' && !PRIORITY_CHIP[task.priority]));
                    if (groupTasks.length === 0) return null;
                    return (
                      <section className={`tasks-priority-group is-${group.tone}`} key={group.key}>
                        <header>
                          <div><span className="tasks-priority-dot" /><div><strong>{group.title}</strong><small>{group.hint}</small></div></div>
                          <b>{groupTasks.length}</b>
                        </header>
                        <div className="tasks-list-card">
                          {groupTasks.map((task) => {
                            const isDone = task.status === 'done';
                            const prio = PRIORITY_CHIP[task.priority] ?? PRIORITY_CHIP.low;
                            const due = task.due_date ? getDueInfo(task.due_date, isDone) : null;
                            const subCount = subtaskCounts[task.id] || 0;
                            return (
                              <IonItemSliding key={task.id}>
                                <IonItem className="ff-item" lines="none">
                                  <div className={`task-compact-row ${isDone ? 'is-done' : ''}`}>
                                    <IonCheckbox checked={isDone} onIonChange={() => handleToggleComplete(task.id, task.status)} />
                                    <div className="task-compact-main" onClick={() => { setDetailTask(task); setShowDetail(true); }}>
                                      {task.parent_task_id && <span className="task-parent-label">↳ Alt görev</span>}
                                      <p>{task.title}</p>
                                      <div className="task-compact-meta">
                                        {due && <span className={due.cls}><IonIcon icon={calendarOutline} />{due.label}</span>}
                                        {task.estimated_minutes && <span><IonIcon icon={hourglassOutline} />{task.estimated_minutes} dk</span>}
                                        {subCount > 0 && <span><IonIcon icon={gitBranchOutline} />{subCount} alt görev</span>}
                                      </div>
                                    </div>
                                    <span className={`task-priority-label ${prio.cls}`}>{prio.label}</span>
                                  </div>
                                </IonItem>
                                <IonItemOptions side="end">
                                  <IonItemOption onClick={() => handleDeleteTask(task.id)}><IonIcon slot="icon-only" icon={trashOutline} /></IonItemOption>
                                </IonItemOptions>
                              </IonItemSliding>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })
                )}
              </>
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
