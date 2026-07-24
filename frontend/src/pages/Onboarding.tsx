import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonProgressBar,
  IonItem,
  IonLabel,
  IonInput,
  IonIcon,
  IonChip,
  IonText,
  IonToast,
} from '@ionic/react';
import {
  add as addIcon,
  close,
  arrowBack,
  arrowForward,
  checkmarkCircle,
} from 'ionicons/icons';
import api from '../services/api';
import parrotImg from '../assets/parrot-login.png';

interface OnboardingProps {
  onComplete: () => void; // başarıyla bitince (App bayrağı set eder)
}

// Küçük eklenebilir liste bileşeni (hedefler / alışkanlıklar için)
const ChipList: React.FC<{
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
}> = ({ items, onAdd, onRemove, placeholder }) => {
  const [val, setVal] = useState('');
  const handleAdd = () => {
    const v = val.trim();
    if (v) {
      onAdd(v);
      setVal('');
    }
  };
  return (
    <div>
      <IonItem style={{ borderRadius: '12px' }}>
        <IonInput
          value={val}
          placeholder={placeholder}
          onIonInput={(e) => setVal(e.detail.value!)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          style={{ '--color': 'var(--ion-text-color)' }}
        />
        <IonButton slot="end" fill="clear" onClick={handleAdd}>
          <IonIcon slot="icon-only" icon={addIcon} />
        </IonButton>
      </IonItem>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
        {items.map((it, i) => (
          <IonChip key={i} onClick={() => onRemove(i)} color="primary">
            <IonLabel>{it}</IonLabel>
            <IonIcon icon={close} />
          </IonChip>
        ))}
      </div>
    </div>
  );
};

const CHALLENGES = [
  { value: 'procrastination', label: 'Erteleme', emoji: '⏳' },
  { value: 'focus', label: 'Odaklanamama', emoji: '🎯' },
  { value: 'prioritization', label: 'Önceliklendirme', emoji: '📊' },
  { value: 'motivation', label: 'Motivasyon eksikliği', emoji: '🔋' },
];

const HOURS = ['1', '2', '3', '4', '5', '6+'];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0); // 0..3
  const [goals, setGoals] = useState<string[]>([]);
  const [hours, setHours] = useState('3');
  const [challenge, setChallenge] = useState('');
  const [mustDo, setMustDo] = useState<string[]>([]);
  const [growth, setGrowth] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const notify = (m: string) => { setToastMessage(m); setShowToast(true); };

  const TOTAL = 4;
  const isLast = step === TOTAL - 1;

  // Adım geçiş koşulları
  const canNext =
    step === 0 ? goals.length >= 1 :
    step === 1 ? !!hours :
    step === 2 ? !!challenge :
    true;
  const canFinish = mustDo.length >= 2 && growth.length >= 1;

  const finish = async () => {
    setSaving(true);
    try {
      // 1) Onboarding verisi
      await api.put('/auth/onboarding', {
        primary_goals: goals,
        routine_hours_per_day: hours,
        biggest_challenge: challenge || undefined,
      });
      // 2) Alışkanlıkları tek tek oluştur
      for (const t of mustDo) {
        await api.post('/habits/', { title: t, category: 'must_do' });
      }
      for (const t of growth) {
        await api.post('/habits/', { title: t, category: 'growth' });
      }
      onComplete();
    } catch (err) {
      notify('Kaydedilemedi. Lütfen tekrar dene.');
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Başlangıç ({step + 1}/{TOTAL})</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onComplete}>Atla</IonButton>
          </IonButtons>
        </IonToolbar>
        <IonProgressBar value={(step + 1) / TOTAL} color="warning" style={{ height: '6px' }} />
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        {/* ADIM 1: Hedefler */}
        {step === 0 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <img src={parrotImg} alt="Forge" style={{ width: '96px', height: '96px', objectFit: 'contain' }} />
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--ion-color-primary)' }}>
                Hoş geldin! 👋
              </h1>
              <IonText color="medium">Seni tanıyalım. 2026 için hedeflerin neler?</IonText>
            </div>
            <ChipList
              items={goals}
              onAdd={(v) => setGoals((p) => [...p, v])}
              onRemove={(i) => setGoals((p) => p.filter((_, idx) => idx !== i))}
              placeholder="Örn: Haftada 3 gün spor"
            />
            {goals.length === 0 && (
              <IonText color="medium" style={{ display: 'block', fontSize: '13px', marginTop: '12px' }}>
                Devam etmek için en az bir hedef ekle.
              </IonText>
            )}
          </div>
        )}

        {/* ADIM 2: Çalışma saatleri */}
        {step === 1 && (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>Günde kaç saat?</h1>
            <IonText color="medium">Hedeflerin için günde ne kadar net vakit ayırabilirsin?</IonText>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px' }}>
              {HOURS.map((h) => (
                <IonButton
                  key={h}
                  fill={hours === h ? 'solid' : 'outline'}
                  onClick={() => setHours(h)}
                  style={{ '--border-radius': '20px', minWidth: '64px' }}
                >
                  {h} saat
                </IonButton>
              ))}
            </div>
          </div>
        )}

        {/* ADIM 3: En büyük zorluk */}
        {step === 2 && (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>En büyük zorluğun?</h1>
            <IonText color="medium">Forge sana buna göre koçluk yapacak.</IonText>
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {CHALLENGES.map((c) => {
                const selected = challenge === c.value;
                return (
                  <div
                    key={c.value}
                    onClick={() => setChallenge(c.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px',
                      borderRadius: '14px',
                      cursor: 'pointer',
                      border: selected ? '2px solid var(--ion-color-primary)' : '1px solid rgba(var(--ion-text-color-rgb,0,0,0),0.12)',
                      background: selected ? 'rgba(var(--ion-color-primary-rgb), 0.1)' : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{c.emoji}</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{c.label}</span>
                    {selected && <IonIcon icon={checkmarkCircle} style={{ color: 'var(--ion-color-primary)', fontSize: '22px' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ADIM 4: Alışkanlıklar (YZTA-105) */}
        {step === 3 && (
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '4px' }}>Alışkanlıkların</h1>
            <IonText color="medium">En az 2 "olmazsa olmaz" ve 1 "geliştirmek istediğin" ekle.</IonText>

            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '20px 0 8px 0' }}>
              Günlük olmazsa olmazların <IonText color="medium" style={{ fontSize: '13px' }}>({mustDo.length}/2)</IonText>
            </h2>
            <ChipList
              items={mustDo}
              onAdd={(v) => setMustDo((p) => [...p, v])}
              onRemove={(i) => setMustDo((p) => p.filter((_, idx) => idx !== i))}
              placeholder="Örn: 2 litre su iç"
            />

            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '24px 0 8px 0' }}>
              Bu ay geliştirmek istediğin <IonText color="medium" style={{ fontSize: '13px' }}>({growth.length}/1)</IonText>
            </h2>
            <ChipList
              items={growth}
              onAdd={(v) => setGrowth((p) => [...p, v])}
              onRemove={(i) => setGrowth((p) => p.filter((_, idx) => idx !== i))}
              placeholder="Örn: Her gün 20 dk kitap"
            />

            {!canFinish && (
              <IonText color="medium" style={{ display: 'block', fontSize: '13px', marginTop: '16px' }}>
                Bitirmek için en az 2 olmazsa olmaz ve 1 gelişim alışkanlığı gerekli.
              </IonText>
            )}
          </div>
        )}

        {/* Gezinme butonları */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '32px' }}>
          {step > 0 && (
            <IonButton fill="outline" onClick={() => setStep((s) => s - 1)} style={{ '--border-radius': '25px' }}>
              <IonIcon slot="start" icon={arrowBack} />
              Geri
            </IonButton>
          )}
          {!isLast ? (
            <IonButton
              expand="block"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              style={{ flex: 1, '--border-radius': '25px', fontWeight: 'bold' }}
            >
              İleri
              <IonIcon slot="end" icon={arrowForward} />
            </IonButton>
          ) : (
            <IonButton
              expand="block"
              onClick={finish}
              disabled={!canFinish || saving}
              style={{ flex: 1, '--border-radius': '25px', fontWeight: 'bold' }}
            >
              {saving ? 'Kaydediliyor...' : 'Başla 🚀'}
            </IonButton>
          )}
        </div>

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

export default Onboarding;
