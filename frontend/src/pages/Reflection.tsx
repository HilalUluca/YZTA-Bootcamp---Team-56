import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonModal,
  IonLabel,
  IonItem,
  IonTextarea,
  IonRange,
  IonIcon,
  IonText,
  IonToast,
} from '@ionic/react';
import { checkmarkCircle } from 'ionicons/icons';
import api from '../services/api';
import forgeAvatar from '../assets/hmsc/circular-parrot-avatar.jpg';
import reflectionIcon from '../assets/hmsc/coral-reflection-icon.jpg';
import leafDecoration from '../assets/hmsc/leaf-tropical-cluster.jpg';
import './Reflection.css';

// Backend MoodLevel değerleri: bad, low, neutral, good, great (kötü → iyi)
const MOODS = [
  { value: 'bad', emoji: '😞', label: 'Çok kötü' },
  { value: 'low', emoji: '😕', label: 'Kötü' },
  { value: 'neutral', emoji: '😐', label: 'Orta' },
  { value: 'good', emoji: '🙂', label: 'İyi' },
  { value: 'great', emoji: '😄', label: 'Çok iyi' },
];

export interface ReflectionData {
  mood: string;
  energy_level: number;
  wins?: string | null;
  improvements?: string | null;
}

interface ReflectionProps {
  isOpen: boolean;
  onClose: () => void;
  existing: ReflectionData | null; // bugün zaten yapıldıysa dolu gelir
  onSaved: (r: ReflectionData) => void;
}

const moodInfo = (value: string) => MOODS.find((m) => m.value === value) || MOODS[2];

const Reflection: React.FC<ReflectionProps> = ({ isOpen, onClose, existing, onSaved }) => {
  const [editing, setEditing] = useState(false); // özet gösterilirken düzenlemeye geçiş
  const [mood, setMood] = useState('neutral');
  const [energy, setEnergy] = useState(3);
  const [wins, setWins] = useState('');
  const [improvements, setImprovements] = useState('');
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Modal her açıldığında form alanlarını mevcut kayıttan (varsa) doldur
  useEffect(() => {
    if (isOpen) {
      setEditing(false);
      setMood(existing?.mood || 'neutral');
      setEnergy(existing?.energy_level || 3);
      setWins(existing?.wins || '');
      setImprovements(existing?.improvements || '');
    }
  }, [isOpen, existing]);

  const notify = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        mood,
        energy_level: energy,
        wins: wins.trim() || undefined,
        improvements: improvements.trim() || undefined,
      };
      const res = await api.post('/reflections/', body);
      notify('Yansıman kaydedildi ✅ (+25 XP)');
      onSaved(res.data);
      onClose();
    } catch {
      notify('Yansıma kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  // Bugün zaten yapılmış ve düzenleme modunda değilsek: ÖZET göster
  const showSummary = !!existing && !editing;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose} className="reflection-modal">
      <IonHeader className="reflection-header">
        <IonToolbar className="reflection-toolbar">
          <IonButtons slot="start">
            <IonButton onClick={onClose} className="reflection-close">Kapat</IonButton>
          </IonButtons>
          <IonTitle>Günlük Yansıma</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="reflection-content">
        <div className="reflection-shell">
        {showSummary ? (
          /* ---------- Bugün tamamlandı: ÖZET ---------- */
          <div className="reflection-summary">
            <div className="reflection-summary-avatar">
              <img src={forgeAvatar} alt="Forge maskotu" />
              <IonIcon icon={checkmarkCircle} />
            </div>
            <IonIcon
              icon={checkmarkCircle}
              style={{ fontSize: '64px', color: 'var(--ion-color-tertiary)', marginTop: '16px' }}
            />
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--ion-text-color)' }}>
              Bugünü değerlendirdin! 🎉
            </h1>
            <IonText color="medium">Yarın da görüşmek üzere.</IonText>

            <div style={{ fontSize: '56px', margin: '20px 0 4px 0' }}>{moodInfo(existing!.mood).emoji}</div>
            <p style={{ margin: 0, color: 'var(--ion-color-medium)' }}>
              Ruh hali: <b>{moodInfo(existing!.mood).label}</b> · Enerji: <b>{existing!.energy_level}/5</b>
            </p>

            {existing!.wins && (
              <div style={{ textAlign: 'left', marginTop: '24px' }}>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--ion-color-primary)' }}>Bugün ne iyi gitti?</h3>
                <p style={{ margin: 0 }}>{existing!.wins}</p>
              </div>
            )}
            {existing!.improvements && (
              <div style={{ textAlign: 'left', marginTop: '16px' }}>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--ion-color-primary)' }}>Yarın ne değişir?</h3>
                <p style={{ margin: 0 }}>{existing!.improvements}</p>
              </div>
            )}

            <IonButton
              expand="block"
              fill="outline"
              onClick={() => setEditing(true)}
              style={{ marginTop: '32px', '--border-radius': '25px' }}
            >
              Düzenle
            </IonButton>
          </div>
        ) : (
          /* ---------- Form ---------- */
          <div className="reflection-form">
            <section className="reflection-intro">
              <img className="reflection-intro-leaf" src={leafDecoration} alt="" aria-hidden="true" />
              <div className="reflection-intro-copy">
                <span><img src={reflectionIcon} alt="" aria-hidden="true" /> Günlük check-in</span>
                <h1>Bugün nasıl hissediyorsun?</h1>
                <p>Kendine bir dakika ayır ve gününü Forge ile değerlendir.</p>
              </div>
              <img className="reflection-intro-forge" src={forgeAvatar} alt="FocusForge maskotu Forge" />
            </section>

            <section className="reflection-card">
              <div className="reflection-section-heading"><span>01</span><div><h2>Ruh halin</h2><p>Sana en yakın olanı seç</p></div></div>
              <div className="reflection-moods">
              {MOODS.map((m) => {
                const selected = mood === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={`reflection-mood ${selected ? 'is-selected' : ''}`}
                    aria-pressed={selected}
                  >
                    <span>{m.emoji}</span>
                    <small>{m.label}</small>
                  </button>
                );
              })}
              </div>
            </section>

            <section className="reflection-card">
              <div className="reflection-section-heading reflection-energy-heading"><span>02</span><div><h2>Enerji seviyen</h2><p>1 sakin, 5 oldukça enerjik</p></div><strong>{energy}/5</strong></div>
            <IonItem lines="none" className="reflection-range-item">
              <IonRange
                min={1}
                max={5}
                step={1}
                snaps
                ticks
                pin
                value={energy}
                onIonInput={(e) => setEnergy(e.detail.value as number)}
                className="reflection-range"
              >
                <IonLabel slot="start">1</IonLabel>
                <IonLabel slot="end">5</IonLabel>
              </IonRange>
            </IonItem>
            </section>

            <section className="reflection-card reflection-writing">
              <div className="reflection-section-heading"><span>03</span><div><h2>Kısa notların</h2><p>Bu alanları istersen boş bırakabilirsin</p></div></div>
            <IonItem className="reflection-text-field" lines="none">
              <IonLabel position="stacked">Bugün ne iyi gitti?</IonLabel>
              <IonTextarea
                value={wins}
                placeholder="Bugünkü küçük ya da büyük kazanımların..."
                autoGrow
                onIonInput={(e) => setWins(e.detail.value!)}
              />
            </IonItem>

            <IonItem className="reflection-text-field" lines="none">
              <IonLabel position="stacked">Yarın ne değiştirirsin?</IonLabel>
              <IonTextarea
                value={improvements}
                placeholder="Yarın için bir küçük iyileştirme..."
                autoGrow
                onIonInput={(e) => setImprovements(e.detail.value!)}
              />
            </IonItem>
            </section>

            <IonButton
              expand="block"
              onClick={handleSave}
              disabled={saving}
              className="reflection-save-button"
            >
              {saving ? 'Kaydediliyor...' : 'Yansımamı Kaydet'}
            </IonButton>
          </div>
        )}

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2500}
        />
        </div>
      </IonContent>
    </IonModal>
  );
};

export default Reflection;
