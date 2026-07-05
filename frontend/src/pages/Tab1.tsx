import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonList,
  IonItem,
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
} from '@ionic/react';
import { add, alertCircleOutline, hourglassOutline } from 'ionicons/icons';
import './Tab1.css';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  estimated_minutes?: number;
}

const Tab1: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'mock-1',
      title: 'FocusForge sunum slaytlarını hazırla',
      description: 'Takım içi sunum için slaytların ve grafiklerin çıkarılması.',
      priority: 'urgent_important',
      status: 'todo',
      estimated_minutes: 45,
    },
    {
      id: 'mock-2',
      title: 'FastAPI veritabanı şemasını incele',
      description: 'SQLAlchemy modelleri ve ilişkileri gözden geçirilecek.',
      priority: 'important',
      status: 'todo',
      estimated_minutes: 30,
    },
    {
      id: 'mock-3',
      title: 'Ionic React mobil arayüz prototipini tamamla',
      description: 'Sekmeli mobil arayüzün statik ekranlarının hazırlanması.',
      priority: 'urgent',
      status: 'done',
      estimated_minutes: 60,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Yeni görev formu state'leri
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('low');
  const [estMinutes, setEstMinutes] = useState<number | undefined>(undefined);

  const handleRefresh = async (event: CustomEvent) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      event.detail.complete();
    }, 800);
  };

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    if (currentStatus === 'done') return;

    setTasks(prevTasks =>
      prevTasks.map(t => (t.id === taskId ? { ...t, status: 'done' } : t))
    );
    setToastMessage('Görev tamamlandı! Tebrikler 🎉');
    setShowToast(true);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newTask: Task = {
      id: Math.random().toString(),
      title,
      description: description || undefined,
      priority,
      status: 'todo',
      estimated_minutes: estMinutes || undefined,
    };

    setTasks(prevTasks => [newTask, ...prevTasks]);
    setToastMessage('Görev başarıyla eklendi (Mock).');
    setShowToast(true);
    
    // Formu temizle ve kapat
    setTitle('');
    setDescription('');
    setPriority('low');
    setEstMinutes(undefined);
    setShowModal(false);
  };

  // Öncelik renkleri ve etiketleri
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Görevlerim</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <IonLoading isOpen={isLoading} message="Yükleniyor..." />

        {tasks.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-medium)' }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '64px' }} />
            <h3>Henüz bir görevin yok!</h3>
            <p>Aşağıdaki "+" butonuna basarak ilk görevini ekleyebilirsin.</p>
          </div>
        ) : (
          <IonList>
            {tasks.map((task) => (
              <IonItem key={task.id} style={{ '--padding-start': '0px', marginBottom: '8px', borderRadius: '8px' }}>
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

