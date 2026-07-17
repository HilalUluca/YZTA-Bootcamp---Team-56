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
    } catch (err) {
      notify('Yansıma kaydedilemedi. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  };

  // Bugün zaten yapılmış ve düzenleme modunda değilsek: ÖZET göster
  const showSummary = !!existing && !editing;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Kapat</IonButton>
          </IonButtons>
          <IonTitle>Günlük Yansıma</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        {showSummary ? (
          /* ---------- Bugün tamamlandı: ÖZET ---------- */
          <div style={{ textAlign: 'center' }}>
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
          <>
            <h2 style={{ fontWeight: 'bold', marginTop: '8px' }}>Bugün nasıl hissediyorsun?</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0 24px 0' }}>
              {MOODS.map((m) => {
                const selected = mood === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    style={{
                      background: selected ? 'rgba(var(--ion-color-primary-rgb), 0.15)' : 'transparent',
                      border: selected ? '2px solid var(--ion-color-primary)' : '2px solid transparent',
                      borderRadius: '14px',
                      padding: '6px 4px',
                      cursor: 'pointer',
                      flex: 1,
                      margin: '0 2px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '28px' }}>{m.emoji}</div>
                    <div style={{ fontSize: '10px', color: 'var(--ion-color-medium)', marginTop: '2px' }}>{m.label}</div>
                  </button>
                );
              })}
            </div>

            <h2 style={{ fontWeight: 'bold' }}>Enerji seviyen</h2>
            <IonItem lines="none" style={{ '--background': 'transparent' }}>
              <IonRange
                min={1}
                max={5}
                step={1}
                snaps
                ticks
                pin
                value={energy}
                onIonInput={(e) => setEnergy(e.detail.value as number)}
                style={{ paddingInline: 0 }}
              >
                <IonLabel slot="start">1</IonLabel>
                <IonLabel slot="end">5</IonLabel>
              </IonRange>
            </IonItem>
            <p style={{ textAlign: 'center', margin: '0 0 16px 0', color: 'var(--ion-color-medium)' }}>
              Enerji: <b style={{ color: 'var(--ion-text-color)' }}>{energy}/5</b>
            </p>

            <IonItem style={{ marginBottom: '16px', borderRadius: '12px' }}>
              <IonLabel position="stacked">Bugün ne iyi gitti?</IonLabel>
              <IonTextarea
                value={wins}
                placeholder="Bugünkü küçük ya da büyük kazanımların..."
                autoGrow
                onIonInput={(e) => setWins(e.detail.value!)}
              />
            </IonItem>

            <IonItem style={{ marginBottom: '24px', borderRadius: '12px' }}>
              <IonLabel position="stacked">Yarın ne değiştirirsin?</IonLabel>
              <IonTextarea
                value={improvements}
                placeholder="Yarın için bir küçük iyileştirme..."
                autoGrow
                onIonInput={(e) => setImprovements(e.detail.value!)}
              />
            </IonItem>

            <IonButton
              expand="block"
              onClick={handleSave}
              disabled={saving}
              style={{ '--border-radius': '25px', height: '50px', fontWeight: 'bold' }}
            >
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </IonButton>
          </>
        )}

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

export default Reflection;
