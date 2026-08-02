import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonModal,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  IonText,
  IonToast,
  IonCheckbox,
} from '@ionic/react';
import {
  sparklesOutline,
  trashOutline,
  saveOutline,
  calendarOutline,
  alertCircleOutline,
  timeOutline,
  closeCircleOutline,
} from 'ionicons/icons';
import type { AxiosError } from 'axios';
import api from '../services/api';
import './TaskDetail.css';

export interface DetailTask {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  due_date?: string | null;
  estimated_minutes?: number | null;
}

interface TaskDetailProps {
  isOpen: boolean;
  task: DetailTask | null;
  onClose: () => void;
  onChanged: () => void; // düzenleme / silme / parçalama sonrası listeyi yenile
}

// AI'ın döndürdüğü alt görev (POST /api/tasks/break-down)
interface SubTask {
  name: string;
  estimated_time_minutes: number;
  description?: string;
}

interface EditableSubTask extends SubTask {
  id: string;
  selected: boolean;
}

const PRIORITIES = [
  { value: 'urgent_important', label: 'Acil & Önemli' },
  { value: 'important', label: 'Önemli' },
  { value: 'urgent', label: 'Acil' },
  { value: 'low', label: 'Düşük Öncelik' },
];

const TaskDetail: React.FC<TaskDetailProps> = ({ isOpen, task, onClose, onChanged }) => {
  // Düzenlenebilir alanlar
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('low');
  const [saving, setSaving] = useState(false);

  // AI parçalama
  const [breaking, setBreaking] = useState(false);
  const [breakError, setBreakError] = useState<string | null>(null);
  const [subtasks, setSubtasks] = useState<EditableSubTask[] | null>(null);
  const [approach, setApproach] = useState('');
  const [savingSubs, setSavingSubs] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const notify = (m: string) => {
    setToastMessage(m);
    setShowToast(true);
  };

  // Modal her açıldığında alanları görevden doldur, AI sonucunu temizle
  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setPriority(task.priority || 'low');
      setSubtasks(null);
      setApproach('');
      setBreakError(null);
    }
  }, [isOpen, task]);

  // IonModal'ı HER ZAMAN render ediyoruz (koşullu return null yok) ki
  // açılış animasyonu ve içerik mount'u düzgün çalışsın.
  const dueText = task?.due_date
    ? new Date(task.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // Kaydet: PUT /api/tasks/{id}
  const handleSave = async () => {
    if (!task) return;
    if (!title.trim()) {
      notify('Başlık boş olamaz.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/tasks/${task.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
      });
      notify('Değişiklikler kaydedildi ✅');
      onChanged();
    } catch {
      notify('Kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  // AI ile parçala: POST /api/tasks/break-down
  const handleBreakDown = async () => {
    if (!task) return;
    setBreaking(true);
    setBreakError(null);
    setSubtasks(null);
    try {
      const res = await api.post('/tasks/break-down', {
        task_name: title.trim(),
        task_description: description.trim() || undefined,
        estimated_time: task.estimated_minutes || undefined,
      });
      const suggestedSubtasks: SubTask[] = Array.isArray(res.data.subtasks)
        ? res.data.subtasks
        : [];

      setSubtasks(
        suggestedSubtasks.map((subtask, index) => ({
          ...subtask,
          id: `${Date.now()}-${index}`,
          selected: true,
        }))
      );
      setApproach(res.data.approach_explanation || '');
    } catch (error) {
      const err = error as AxiosError<{ detail?: unknown }>;
      const detail = err.response?.data?.detail;
      setBreakError(
        typeof detail === 'string' ? detail : 'Parçalama yapılamadı. AI servisi şu an yanıt veremiyor olabilir.'
      );
    } finally {
      setBreaking(false);
    }
  };

  const updateSubtask = (id: string, changes: Partial<EditableSubTask>) => {
    setSubtasks((current) =>
      current?.map((subtask) =>
        subtask.id === id ? { ...subtask, ...changes } : subtask
      ) ?? null
    );
  };

  const removeSubtask = (id: string) => {
    setSubtasks((current) => current?.filter((subtask) => subtask.id !== id) ?? null);
  };

  const selectedSubtasks = subtasks?.filter(
    (subtask) => subtask.selected && subtask.name.trim()
  ) ?? [];

  const allSubtasksSelected = Boolean(
    subtasks?.length && subtasks.every((subtask) => subtask.selected)
  );

  const toggleAllSubtasks = (selected: boolean) => {
    setSubtasks((current) =>
      current?.map((subtask) => ({ ...subtask, selected })) ?? null
    );
  };

  // Alt görevleri kaydet: POST /api/planner/bulk-create (parent_task_id ile bağlar)
  const handleSaveSubtasks = async () => {
    if (!task || selectedSubtasks.length === 0) {
      notify('Eklemek için en az bir alt görev seçmelisin.');
      return;
    }
    setSavingSubs(true);
    try {
      await api.post('/planner/bulk-create', {
        parent_task_id: task.id,
        tasks: selectedSubtasks.map((subtask) => ({
          title: subtask.name.trim(),
          description: subtask.description?.trim() || undefined,
          estimated_minutes: Math.max(1, subtask.estimated_time_minutes || 1),
          priority: 'low',
        })),
      });
      notify(`${selectedSubtasks.length} alt görev listene eklendi ✅`);
      onChanged();
      onClose();
    } catch {
      notify('Alt görevler kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSavingSubs(false);
    }
  };

  // Sil: DELETE /api/tasks/{id}
  const handleDelete = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      notify('Görev silindi 🗑️');
      onChanged();
      onClose();
    } catch {
      notify('Silinemedi. Lütfen tekrar dene.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Kapat</IonButton>
          </IonButtons>
          <IonTitle>Görev Detayı</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        {/* Tarih bilgisi (salt-okunur) */}
        {dueText && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--ion-color-medium)', marginBottom: '12px' }}>
            <IonIcon icon={calendarOutline} />
            <span style={{ fontSize: '14px' }}>Teslim: {dueText}</span>
          </div>
        )}

        {/* Düzenlenebilir alanlar */}
        <IonItem style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <IonLabel position="stacked">Başlık</IonLabel>
          <IonInput value={title} onIonInput={(e) => setTitle(e.detail.value!)} />
        </IonItem>

        <IonItem style={{ marginBottom: '12px', borderRadius: '12px' }}>
          <IonLabel position="stacked">Açıklama</IonLabel>
          <IonTextarea
            value={description}
            autoGrow
            placeholder="Göreve dair detaylar..."
            onIonInput={(e) => setDescription(e.detail.value!)}
          />
        </IonItem>

        <IonItem style={{ marginBottom: '16px', borderRadius: '12px' }}>
          <IonLabel position="stacked">Öncelik</IonLabel>
          <IonSelect value={priority} onIonChange={(e) => setPriority(e.detail.value)} interface="popover">
            {PRIORITIES.map((p) => (
              <IonSelectOption key={p.value} value={p.value}>{p.label}</IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        <IonButton
          expand="block"
          onClick={handleSave}
          disabled={saving}
          style={{ '--border-radius': '25px', height: '48px', fontWeight: 'bold' }}
        >
          <IonIcon slot="start" icon={saveOutline} />
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </IonButton>

        {/* AI ile Parçala */}
        <div style={{ marginTop: '28px' }}>
          <h2 style={{ fontWeight: 'bold', fontSize: '17px', marginBottom: '4px' }}>Bu görev büyük mü?</h2>
          <IonText color="medium" style={{ fontSize: '14px' }}>
            Forge onu küçük, yapılabilir adımlara bölsün.
          </IonText>

          <IonButton
            expand="block"
            fill="outline"
            onClick={handleBreakDown}
            disabled={breaking}
            style={{ marginTop: '12px', '--border-radius': '25px' }}
          >
            <IonIcon slot="start" icon={sparklesOutline} />
            AI ile Parçala
          </IonButton>

          {/* Parçalama yükleniyor */}
          {breaking && (
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(1.4)' }} />
              <p style={{ color: 'var(--ion-color-medium)' }}>Forge görevi adımlara bölüyor...</p>
            </div>
          )}

          {/* Parçalama hatası */}
          {breakError && !breaking && (
            <div style={{ textAlign: 'center', marginTop: '16px', color: 'var(--ion-color-danger)' }}>
              <IonIcon icon={alertCircleOutline} style={{ fontSize: '40px' }} />
              <p style={{ color: 'var(--ion-color-medium)' }}>{breakError}</p>
              <IonButton onClick={handleBreakDown} fill="clear" color="danger" size="small">Tekrar Dene</IonButton>
            </div>
          )}

          {/* Parçalama sonucu */}
          {subtasks && !breaking && (
            <div style={{ marginTop: '16px' }}>
              {approach && (
                <div style={{ background: 'rgba(var(--ion-color-primary-rgb), 0.1)', borderRadius: '12px', padding: '12px', marginBottom: '12px' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--ion-text-color)' }}>{approach}</p>
                </div>
              )}

              {subtasks.length === 0 ? (
                <p style={{ color: 'var(--ion-color-medium)' }}>Listede alt görev kalmadı. Yeniden parçalayabilirsin.</p>
              ) : (
                <>
                  <div className="subtask-list-header">
                    <IonCheckbox
                      checked={allSubtasksSelected}
                      onIonChange={(event) => toggleAllSubtasks(event.detail.checked)}
                      aria-label="Tüm alt görevleri seç"
                    />
                    <span>Tümünü seç</span>
                    <span className="subtask-selection-count">
                      {selectedSubtasks.length}/{subtasks.length} seçili
                    </span>
                  </div>

                  {subtasks.map((s, i) => (
                    <div
                      key={s.id}
                      className={`editable-subtask-card${s.selected ? '' : ' is-unselected'}`}
                    >
                      <div className="editable-subtask-card__top">
                        <IonCheckbox
                          checked={s.selected}
                          onIonChange={(event) => updateSubtask(s.id, { selected: event.detail.checked })}
                          aria-label={`${i + 1}. alt görevi seç`}
                        />
                        <span className="editable-subtask-card__number">{i + 1}</span>
                        <IonInput
                          className="editable-subtask-card__title"
                          value={s.name}
                          placeholder="Alt görev başlığı"
                          onIonInput={(event) => updateSubtask(s.id, { name: event.detail.value ?? '' })}
                          aria-label={`${i + 1}. alt görev başlığı`}
                        />
                        <IonButton
                          fill="clear"
                          color="medium"
                          size="small"
                          onClick={() => removeSubtask(s.id)}
                          aria-label={`${i + 1}. alt görevi kaldır`}
                        >
                          <IonIcon slot="icon-only" icon={closeCircleOutline} />
                        </IonButton>
                      </div>

                      <IonTextarea
                        className="editable-subtask-card__description"
                        value={s.description ?? ''}
                        autoGrow
                        rows={1}
                        placeholder="Kısa açıklama (isteğe bağlı)"
                        onIonInput={(event) => updateSubtask(s.id, { description: event.detail.value ?? '' })}
                        aria-label={`${i + 1}. alt görev açıklaması`}
                      />

                      <div className="editable-subtask-card__duration">
                          <IonIcon icon={timeOutline} />
                          <IonInput
                            type="number"
                            min="1"
                            value={s.estimated_time_minutes}
                            onIonInput={(event) =>
                              updateSubtask(s.id, {
                                estimated_time_minutes: Math.max(1, Number(event.detail.value) || 1),
                              })
                            }
                            aria-label={`${i + 1}. alt görev süresi`}
                          />
                          <span>dk</span>
                      </div>
                    </div>
                  ))}

                  <IonButton
                    expand="block"
                    onClick={handleSaveSubtasks}
                    disabled={savingSubs || selectedSubtasks.length === 0}
                    style={{ marginTop: '16px', '--border-radius': '25px', fontWeight: 'bold' }}
                  >
                    {savingSubs
                      ? 'Ekleniyor...'
                      : `Seçilenleri Görevlere Ekle (${selectedSubtasks.length})`}
                  </IonButton>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sil */}
        <IonButton
          expand="block"
          color="danger"
          fill="outline"
          onClick={handleDelete}
          disabled={deleting}
          style={{ marginTop: '32px', '--border-radius': '25px' }}
        >
          <IonIcon slot="start" icon={trashOutline} />
          {deleting ? 'Siliniyor...' : 'Görevi Sil'}
        </IonButton>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2500}
        />
      </IonContent>
    </IonModal>
  );
};

export default TaskDetail;
