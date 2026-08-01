import React, { useState, useEffect, useRef } from 'react';
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
  arrowUndoOutline,
} from 'ionicons/icons';
import api from '../services/api';
import HabitStats from './HabitStats';
import forgeAvatar from '../assets/hmsc/circular-parrot-avatar.jpg';
import habitsIcon from '../assets/hmsc/blue-habits-icon.jpg';
import streakIcon from '../assets/hmsc/daily-streak-icon.jpg';
import leafDecoration from '../assets/hmsc/leaf-tropical-cluster.jpg';
import './Habits.css';

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
  const [view, setView] = useState<'today' | 'stats'>('today'); // Bugün / İstatistik
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

  // 5 saniyelik geri alma: habitId -> son teslim zamanı (ms). Bu süre içinde istek gitmez.
  const [pending, setPending] = useState<Record<string, number>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [, setTick] = useState(0); // geri sayımı yeniden çizmek için

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
    } catch {
      setError('Alışkanlıklar yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  // Modal her açıldığında güncel veriyi çek
  useEffect(() => {
    if (isOpen) {
      setView('today');
      setShowAdd(false);
      setEditingId(null);
      loadToday();
    }
  }, [isOpen]);

  // Geri sayım görünürken (pending doluyken) her yarım saniyede yeniden çiz
  useEffect(() => {
    if (Object.keys(pending).length === 0) return;
    const iv = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(iv);
  }, [pending]);

  // Bileşen kaldırılırsa bekleyen timer'ları temizle
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // 1) İşaretle: hemen optimistic göster, 5 sn sonra gönderilecek şekilde zamanla (istek HENÜZ gitmez)
  const startCheckIn = (id: string) => {
    if (pending[id] !== undefined) return; // zaten bekliyorsa tekrar başlatma
    setPending((prev) => ({ ...prev, [id]: Date.now() + 5000 }));
    timersRef.current[id] = setTimeout(() => commitCheckIn(id), 5000);
  };

  // 2) Geri al: timer'ı iptal et, işareti kaldır — istek HİÇ gitmez
  const undoCheckIn = (id: string) => {
    const t = timersRef.current[id];
    if (t) clearTimeout(t);
    delete timersRef.current[id];
    setPending((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    notify('Geri alındı, istek gönderilmedi.');
  };

  // 3) Gönder (süre dolunca): POST /habits/check-in
  const commitCheckIn = async (id: string) => {
    delete timersRef.current[id];
    try {
      await api.post('/habits/check-in', { habit_id: id });
      await loadToday();
      onChanged?.();
      notify('Aferin! İşaretlendi 🎉 (+15 XP)');
    } catch {
      notify('İşaretlenemedi. Lütfen tekrar dene.');
    } finally {
      setPending((prev) => {
        const n = { ...prev };
        delete n[id];
        return n;
      });
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
    } catch {
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
    } catch {
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
    } catch {
      notify('Eklenemedi. Lütfen tekrar dene.');
    } finally {
      setBusy(false);
    }
  };

  // İlerleme (bekleyen/optimistic işaretler de tamamlanmış sayılır)
  const total = habits?.length || 0;
  const done = habits?.filter((h) => h.is_completed_today || pending[h.id] !== undefined).length || 0;
  const pct = total > 0 ? done / total : 0;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="habits-modal">
      <IonHeader className="habits-header">
        <IonToolbar className="habits-toolbar">
          <IonButtons slot="start">
            <IonButton onClick={onClose} className="habits-close">Kapat</IonButton>
          </IonButtons>
          <IonTitle>Alışkanlıklar</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="habits-content">
        <div className="habits-shell">
        <section className="habits-intro">
          <img className="habits-intro-leaf" src={leafDecoration} alt="" aria-hidden="true" />
          <div className="habits-intro-copy">
            <span><img src={habitsIcon} alt="" aria-hidden="true" /> Küçük adımlar</span>
            <h1>Rutinini güçlendir</h1>
            <p>Her tamamlanan alışkanlık, hedeflerine atılmış güçlü bir adım.</p>
          </div>
          <img className="habits-intro-forge" src={forgeAvatar} alt="FocusForge maskotu Forge" />
        </section>

        {/* Bugün / İstatistik geçişi */}
        <IonSegment value={view} onIonChange={(e) => setView(e.detail.value as 'today' | 'stats')} className="habits-view-segment">
          <IonSegmentButton value="today"><IonLabel>Bugün</IonLabel></IonSegmentButton>
          <IonSegmentButton value="stats"><IonLabel>İstatistik</IonLabel></IonSegmentButton>
        </IonSegment>

        {view === 'stats' && <HabitStats />}

        {view === 'today' && (
        <>
        {/* Yükleniyor */}
        {loading && (
          <div className="habits-state">
            <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(1.4)' }} />
            <p style={{ color: 'var(--ion-color-medium)' }}>Yükleniyor...</p>
          </div>
        )}

        {/* Hata */}
        {error && !loading && (
          <div className="habits-state habits-error">
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
              <section className="habits-progress-card">
                <div className="habits-progress-heading">
                  <div>
                    <img src={streakIcon} alt="" aria-hidden="true" />
                    <span><small>Bugünkü ilerleme</small><strong>%{Math.round(pct * 100)} tamamlandı</strong></span>
                  </div>
                  <b>{done} / {total}</b>
                </div>
                <IonProgressBar value={pct} color="tertiary" />
                <p>{done === total ? 'Bugünkü hedeflerinin hepsi tamamlandı! 🎉' : `${total - done} alışkanlık daha seni bekliyor.`}</p>
              </section>
            )}

            {/* Boş durum */}
            {total === 0 && (
              <div className="habits-empty">
                <img src={habitsIcon} alt="" aria-hidden="true" />
                <h3>Henüz alışkanlığın yok</h3>
                <p>Aşağıdan ilk alışkanlığını ekleyerek başla.</p>
              </div>
            )}

            {/* Liste */}
            <IonList className="habits-list">
              {habits.map((h) => {
                const cat = categoryInfo(h.category);
                if (editingId === h.id) {
                  return (
                    <IonItem key={h.id} className="habit-edit-card" lines="none">
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
                const isPending = pending[h.id] !== undefined;
                const isChecked = h.is_completed_today || isPending;
                const remaining = isPending ? Math.max(0, Math.ceil((pending[h.id] - Date.now()) / 1000)) : 0;
                return (
                  <React.Fragment key={h.id}>
                  <IonItem className={`habit-card ${isChecked ? 'is-checked' : ''}`} lines="none">
                    <IonCheckbox
                      slot="start"
                      checked={isChecked}
                      disabled={h.is_completed_today || isPending}
                      onIonChange={() => startCheckIn(h.id)}
                      className="habit-checkbox"
                    />
                    <IonLabel className="habit-copy">
                      <h2>
                        {h.title}
                      </h2>
                      <div className="habit-badges">
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

                  {/* 5 saniyelik geri alma şeridi */}
                  {isPending && (
                    <div className="habit-undo-row">
                      <span>
                        İşaretlendi · {remaining} sn içinde kaydedilecek
                      </span>
                      <IonButton size="small" fill="clear" onClick={() => undoCheckIn(h.id)}>
                        <IonIcon slot="start" icon={arrowUndoOutline} />
                        Geri al
                      </IonButton>
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </IonList>

            {/* Yeni alışkanlık ekleme */}
            {showAdd ? (
              <div className="habit-add-card">
                <div className="habit-add-heading"><img src={habitsIcon} alt="" aria-hidden="true" /><div><h2>Yeni alışkanlık</h2><p>Küçük ve sürdürülebilir bir hedef belirle.</p></div></div>
                <IonItem className="habit-add-field" lines="none">
                  <IonLabel position="stacked">Yeni alışkanlık</IonLabel>
                  <IonInput
                    value={newTitle}
                    placeholder="Örn: 2 litre su iç"
                    onIonInput={(e) => setNewTitle(e.detail.value!)}
                  />
                </IonItem>
                <IonSegment value={newCategory} onIonChange={(e) => setNewCategory(e.detail.value as string)} className="habit-category-segment">
                  <IonSegmentButton value="must_do">
                    <IonLabel>Olmazsa olmaz</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="growth">
                    <IonLabel>Gelişim</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
                <div className="habit-add-actions">
                  <IonButton expand="block" onClick={addHabit} disabled={busy || !newTitle.trim()}>
                    Ekle
                  </IonButton>
                  <IonButton fill="clear" color="medium" onClick={() => setShowAdd(false)}>İptal</IonButton>
                </div>
              </div>
            ) : (
              <IonButton
                expand="block"
                onClick={() => setShowAdd(true)}
                className="habit-add-button"
              >
                <IonIcon slot="start" icon={addOutline} />
                Yeni Alışkanlık
              </IonButton>
            )}

            <IonText color="medium" className="habit-save-note">
              İşaretledikten sonra 5 saniye içinde "Geri al"a basabilirsin; basmazsan kaydedilir. Kaydedildikten sonra gün içinde geri alınamaz.
            </IonText>
          </>
        )}
        </>
        )}

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2200}
        />
        </div>
      </IonContent>
    </IonModal>
  );
};

export default Habits;
