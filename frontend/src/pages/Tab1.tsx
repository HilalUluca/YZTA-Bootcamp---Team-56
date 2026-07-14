import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
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
  IonBadge,
  IonToast,
  IonLoading,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
} from '@ionic/react';
import { add, alertCircleOutline, hourglassOutline, flameOutline, trophyOutline, flashOutline, statsChartOutline, trashOutline } from 'ionicons/icons';
import api from '../services/api';
import './Tab1.css';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  estimated_minutes?: number;
  due_date?: string;
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

const Tab1: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
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

  // Görevi tamamla: PATCH /tasks/{id}/complete
  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    if (currentStatus === 'done') return;
    try {
      await api.patch(`/tasks/${taskId}/complete`);
      notify('Görev tamamlandı! 🎉');
      await Promise.all([loadTasks(), loadDashboard()]);
    } catch (err) {
      notify('Görev tamamlanamadı. Lütfen tekrar dene.');
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

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'urgent_important':
        return <IonBadge color="danger">Acil & Önemli</IonBadge>;
      case 'important':
        return <IonBadge color="warning">Önemli</IonBadge>;
      case 'urgent':
        return <IonBadge color="secondary">Acil</IonBadge>;
      default:
        return <IonBadge color="medium">Düşük Öncelik</IonBadge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 50) return 'warning';
    return 'danger';
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>
            {dashboard ? `Merhaba, ${dashboard.user.full_name || dashboard.user.username}` : 'Görevlerim'}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <IonLoading isOpen={isLoading} message="Yükleniyor..." />

        {/* Dashboard Kartları */}
        {dashboard && (
          <IonGrid>
            <IonRow>
              <IonCol size="6">
                <IonCard>
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonIcon icon={trophyOutline} style={{ fontSize: '28px', color: 'var(--ion-color-warning)' }} />
                    <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>Lvl {dashboard.user.level}</h1>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>{dashboard.user.total_xp} XP</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="6">
                <IonCard>
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonIcon icon={flameOutline} style={{ fontSize: '28px', color: 'var(--ion-color-danger)' }} />
                    <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>{dashboard.user.streak_count}</h1>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Gün Streak</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
            <IonRow>
              <IonCol size="6">
                <IonCard>
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonIcon icon={flashOutline} style={{ fontSize: '28px', color: 'var(--ion-color-tertiary)' }} />
                    <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>{dashboard.focus.minutes_today}dk</h1>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Bugün Odaklanma</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="6">
                <IonCard>
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonIcon icon={statsChartOutline} style={{ fontSize: '28px', color: `var(--ion-color-${getScoreColor(dashboard.score.value)})` }} />
                    <h1 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold' }}>{dashboard.score.value}</h1>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--ion-color-medium)' }}>Skor /100</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>
        )}

        {/* Görev Özeti */}
        {dashboard && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <IonChip color="primary">
              <IonLabel>Açık: {dashboard.tasks.open}</IonLabel>
            </IonChip>
            <IonChip color="success">
              <IonLabel>Bugün: {dashboard.tasks.completed_today} ✓</IonLabel>
            </IonChip>
            {dashboard.tasks.overdue > 0 && (
              <IonChip color="danger">
                <IonLabel>Gecikmiş: {dashboard.tasks.overdue}</IonLabel>
              </IonChip>
            )}
          </div>
        )}

        {/* Görev Listesi */}
        <h3 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Görevlerim</h3>

        {error ? (
          <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-danger)' }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '64px' }} />
            <h3>Bir sorun oluştu</h3>
            <p style={{ color: 'var(--ion-color-medium)' }}>{error}</p>
            <IonButton onClick={loadTasks} fill="outline" color="danger" style={{ marginTop: '8px' }}>
              Tekrar Dene
            </IonButton>
          </div>
        ) : tasks.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-medium)' }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '64px' }} />
            <h3>Henüz bir görevin yok!</h3>
            <p>Aşağıdaki "+" butonuna basarak ilk görevini ekleyebilirsin.</p>
          </div>
        ) : (
          <IonList>
            {tasks.map((task) => (
              <IonItemSliding key={task.id}>
                <IonItem style={{ '--padding-start': '0px', marginBottom: '8px', borderRadius: '8px' }}>
                  <IonCheckbox
                    slot="start"
                    checked={task.status === 'done'}
                    disabled={task.status === 'done'}
                    onIonChange={() => handleToggleComplete(task.id, task.status)}
                    style={{ marginRight: '16px' }}
                  />
                  <IonLabel style={{ opacity: task.status === 'done' ? 0.6 : 1 }}>
                    <h2 style={{ textDecoration: task.status === 'done' ? 'line-through' : 'none', fontWeight: 'bold' }}>
                      {task.title}
                    </h2>
                    <p>{task.description || 'Açıklama yok'}</p>
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {getPriorityBadge(task.priority)}
                      {task.estimated_minutes && (
                        <IonBadge color="light" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={hourglassOutline} />
                          {task.estimated_minutes} dk
                        </IonBadge>
                      )}
                    </div>
                  </IonLabel>
                </IonItem>
                <IonItemOptions side="end">
                  <IonItemOption color="danger" onClick={() => handleDeleteTask(task.id)}>
                    <IonIcon slot="icon-only" icon={trashOutline} />
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}
          </IonList>
        )}

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
              <IonItem style={{ marginBottom: '16px' }}>
                <IonLabel position="stacked">Görev Başlığı *</IonLabel>
                <IonInput
                  required
                  value={title}
                  placeholder="Örn: SQL Ödevi Hazırla"
                  onIonInput={(e) => setTitle(e.detail.value!)}
                />
              </IonItem>

              <IonItem style={{ marginBottom: '16px' }}>
                <IonLabel position="stacked">Açıklama</IonLabel>
                <IonTextarea
                  value={description}
                  placeholder="Göreve dair detaylar..."
                  onIonInput={(e) => setDescription(e.detail.value!)}
                />
              </IonItem>

              <IonItem style={{ marginBottom: '16px' }}>
                <IonLabel position="stacked">Öncelik</IonLabel>
                <IonSelect value={priority} onIonChange={(e) => setPriority(e.detail.value)}>
                  <IonSelectOption value="urgent_important">Acil & Önemli (Hemen Yap)</IonSelectOption>
                  <IonSelectOption value="important">Önemli (Planla)</IonSelectOption>
                  <IonSelectOption value="urgent">Acil (Delege Et)</IonSelectOption>
                  <IonSelectOption value="low">Düşük Öncelik (Ertele)</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem style={{ marginBottom: '24px' }}>
                <IonLabel position="stacked">Tahmini Süre (Dakika)</IonLabel>
                <IonInput
                  type="number"
                  value={estMinutes}
                  placeholder="Örn: 45"
                  onIonInput={(e) => setEstMinutes(e.detail.value ? parseInt(e.detail.value) : undefined)}
                />
              </IonItem>

              <IonButton expand="block" type="submit" style={{ '--border-radius': '10px', fontWeight: 'bold' }}>
                Görevi Kaydet
              </IonButton>
            </form>
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
        />
      </IonContent>
    </IonPage>
  );
};

export default Tab1;