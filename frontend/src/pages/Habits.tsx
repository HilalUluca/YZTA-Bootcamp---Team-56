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
  IonCheckbox,
  IonBadge,
  IonIcon,
  IonProgressBar,
  IonSpinner,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonToast,
  IonList,
} from '@ionic/react';
import {
  addOutline,
  createOutline,
  trashOutline,
  checkmarkOutline,
  closeOutline,
  alertCircleOutline,
  flameOutline,
} from 'ionicons/icons';
import api from '../services/api';

interface HabitToday {
  id: string;
  title: string;
  category: string; // must_do | growth
  streak_count: number;
  is_completed_today: boolean;
}

interface HabitsProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void; // check-in sonrası Home XP'sini yenilemek için
}

const categoryInfo = (cat: string) =>
  cat === 'must_do'
    ? { label: 'Olmazsa olmaz', color: 'danger' }
    : { label: 'Gelişim', color: 'tertiary' };

const Habits: React.FC<HabitsProps> = ({ isOpen, onClose, onChanged }) => {
  const [habits, setHabits] = useState<HabitToday[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Düzenleme
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  // Yeni ekleme
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('growth');
  const [busy, setBusy] = useState(false); // ekle/kaydet/sil sırasında

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const notify = (m: string) => {
    setToastMessage(m);
    setShowToast(true);
  };

  const loadToday = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/habits/today');
      setHabits(res.data || []);
    } catch (err) {
      setError('Alışkanlıklar yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  // Modal her açıldığında güncel veriyi çek
  useEffect(() => {
    if (isOpen) {
      setShowAdd(false);
      setEditingId(null);
      loadToday();
    }
  }, [isOpen]);

  // Check-in: POST /habits/check-in (yalnızca işaretlenmemişler için; geri alma backend'de yok)
  const checkIn = async (id: string) => {
    try {
      await api.post('/habits/check-in', { habit_id: id });
      notify('Aferin! İşaretlendi 🎉 (+15 XP)');
      await loadToday();
      onChanged?.();
    } catch (err) {
      notify('İşaretlenemedi. Lütfen tekrar dene.');
    }
  };

  const startEdit = (h: HabitToday) => {
    setEditingId(h.id);
    setEditTitle(h.title);
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setBusy(true);
    try {
      await api.put(`/habits/${id}`, { title: editTitle.trim() });
      setEditingId(null);
      await loadToday();
    } catch (err) {
      notify('Güncellenemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const deleteHabit = async (id: string) => {
    setBusy(true);
    try {
      await api.delete(`/habits/${id}`);
      notify('Alışkanlık silindi 🗑️');
      await loadToday();
    } catch (err) {
      notify('Silinemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  const addHabit = async () => {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await api.post('/habits/', { title: newTitle.trim(), category: newCategory });
      notify('Yeni alışkanlık eklendi ✅');
      setNewTitle('');
      setNewCategory('growth');
      setShowAdd(false);
      await loadToday();
    } catch (err) {
      notify('Eklenemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  // İlerleme
  const total = habits?.length || 0;
  const done = habits?.filter((h) => h.is_completed_today).length || 0;
  const pct = total > 0 ? done / total : 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Kapat</IonButton>
          </IonButtons>
          <IonTitle>Alışkanlıklar</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        {/* Yükleniyor */}
        {loading && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(1.4)' }} />
            <p style={{ color: 'var(--ion-color-medium)' }}>Yükleniyor...</p>
          </div>
        )}

        {/* Hata */}
        {error && !loading && (
          <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-danger)' }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '56px' }} />
            <h3>Bir sorun oluştu</h3>
            <p style={{ color: 'var(--ion-color-medium)' }}>{error}</p>
            <IonButton onClick={loadToday} fill="outline" color="danger">Tekrar Dene</IonButton>
          </div>
        )}

        {habits && !loading && !error && (
          <>
            {/* Üstte tamamlanma yüzdesi + progress bar */}
            {total > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '8px' }}>
                  <span>Bugünkü ilerleme</span>
                  <span style={{ color: 'var(--ion-color-medium)' }}>{done} / {total}</span>
                </div>
                <IonProgressBar value={pct} color="tertiary" style={{ height: '10px', borderRadius: '5px' }} />
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                  %{Math.round(pct * 100)} tamamlandı
                </p>
              </div>
            )}

            {/* Boş durum */}
            {total === 0 && (
              <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-medium)' }}>
                <h3>Henüz alışkanlığın yok</h3>
                <p>Aşağıdan ilk alışkanlığını ekleyerek başla.</p>
              </div>
            )}

            {/* Liste */}
            <IonList style={{ background: 'transparent' }}>
              {habits.map((h) => {
                const cat = categoryInfo(h.category);
                if (editingId === h.id) {
                  return (
                    <IonItem key={h.id} style={{ '--background': 'transparent' }}>
                      <IonInput
                        value={editTitle}
                        onIonInput={(e) => setEditTitle(e.detail.value!)}
                        style={{ '--color': 'var(--ion-text-color)' }}
                      />
                      <IonButtons slot="end">
                        <IonButton onClick={() => saveEdit(h.id)} disabled={busy} color="primary">
                          <IonIcon slot="icon-only" icon={checkmarkOutline} />
                        </IonButton>
                        <IonButton onClick={() => setEditingId(null)} color="medium">
                          <IonIcon slot="icon-only" icon={closeOutline} />
                        </IonButton>
                      </IonButtons>
                    </IonItem>
                  );
                }
                return (
                  <IonItem key={h.id} style={{ '--background': 'transparent' }}>
                    <IonCheckbox
                      slot="start"
                      checked={h.is_completed_today}
                      disabled={h.is_completed_today}
                      onIonChange={() => checkIn(h.id)}
                      style={{ marginRight: '12px' }}
                    />
                    <IonLabel style={{ opacity: h.is_completed_today ? 0.6 : 1 }}>
                      <h2 style={{ fontWeight: 600, textDecoration: h.is_completed_today ? 'line-through' : 'none' }}>
                        {h.title}
                      </h2>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                        <IonBadge color={cat.color}>{cat.label}</IonBadge>
                        {h.streak_count > 0 && (
                          <IonBadge color="warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <IonIcon icon={flameOutline} />
                            {h.streak_count}
                          </IonBadge>
                        )}
                      </div>
                    </IonLabel>
                    <IonButtons slot="end">
                      <IonButton onClick={() => startEdit(h)} color="medium">
                        <IonIcon slot="icon-only" icon={createOutline} />
                      </IonButton>
                      <IonButton onClick={() => deleteHabit(h.id)} disabled={busy} color="danger">
                        <IonIcon slot="icon-only" icon={trashOutline} />
                      </IonButton>
                    </IonButtons>
                  </IonItem>
                );
              })}
            </IonList>

            {/* Yeni alışkanlık ekleme */}
            {showAdd ? (
              <div style={{ marginTop: '16px' }}>
                <IonItem style={{ marginBottom: '10px', borderRadius: '12px' }}>
                  <IonLabel position="stacked">Yeni alışkanlık</IonLabel>
                  <IonInput
                    value={newTitle}
                    placeholder="Örn: 2 litre su iç"
                    onIonInput={(e) => setNewTitle(e.detail.value!)}
                  />
                </IonItem>
                <IonSegment value={newCategory} onIonChange={(e) => setNewCategory(e.detail.value as string)} style={{ marginBottom: '12px' }}>
                  <IonSegmentButton value="must_do">
                    <IonLabel>Olmazsa olmaz</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="growth">
                    <IonLabel>Gelişim</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <IonButton expand="block" onClick={addHabit} disabled={busy || !newTitle.trim()} style={{ flex: 1, '--border-radius': '25px' }}>
                    Ekle
                  </IonButton>
                  <IonButton fill="clear" color="medium" onClick={() => setShowAdd(false)}>İptal</IonButton>
                </div>
              </div>
            ) : (
              <IonButton
                expand="block"
                onClick={() => setShowAdd(true)}
                style={{ marginTop: '16px', '--border-radius': '25px', fontWeight: 'bold' }}
              >
                <IonIcon slot="start" icon={addOutline} />
                Yeni Alışkanlık
              </IonButton>
            )}

            <IonText color="medium" style={{ display: 'block', textAlign: 'center', fontSize: '12px', marginTop: '16px' }}>
              İşaretlenen alışkanlık bugün için kaydedilir; gün içinde geri alınamaz.
            </IonText>
          </>
        )}

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2200}
        />
      </IonContent>
    </IonModal>
  );
};

export default Habits;
