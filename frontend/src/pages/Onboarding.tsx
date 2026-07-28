<<<<<<< HEAD
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
=======
import React, { useMemo, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonLoading,
  IonPage,
  IonProgressBar,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { add, arrowBack, arrowForward, checkmarkCircle, close } from 'ionicons/icons';
import { completeOnboarding } from '../services/authService';
import type { OnboardingData, User } from '../services/types';

interface OnboardingProps {
  /** Onboarding tamamlanınca güncel kullanıcıyla çağrılır. */
  onComplete: (user: User) => void;
}

/**
 * İlk giriş profili (YZTA-71).
 *
 * Kabul kriterlerindeki tüm alanları adım adım toplar: kim olduğu, üslubu,
 * kişiliği, hobileri, uyku saati, yıllık ve günlük hedefleri. Toplanan cevaplar
 * backend'e gönderilince oradan cold-start AI profili (YZTA-27) üretilir.
 */

const COMM_STYLES = ['samimi', 'resmi', 'esprili', 'sert ve net', 'motive edici'];

const CHALLENGES: { value: string; label: string }[] = [
  { value: 'procrastination', label: 'Erteleme' },
  { value: 'focus', label: 'Odaklanma' },
  { value: 'prioritization', label: 'Önceliklendirme' },
  { value: 'motivation', label: 'Motivasyon' },
];

const TECHNIQUES: { value: string; label: string }[] = [
  { value: 'pomodoro', label: 'Pomodoro' },
  { value: 'timeblocking', label: 'Zaman bloklama' },
  { value: 'none', label: 'Belirli bir teknik yok' },
];

const TOTAL_STEPS = 4;

/** Etikete (chip) dayalı liste alanı: yaz, Ekle'ye bas, sil. */
const ListField: React.FC<{
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}> = ({ label, placeholder, items, onChange }) => {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...items, value]);
    setDraft('');
  };

  return (
    <div style={{ marginBottom: '20px' }}>
      <IonItem lines="full" style={{ borderRadius: '12px' }}>
        <IonLabel position="stacked">{label}</IonLabel>
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '8px' }}>
          <IonInput
            value={draft}
            placeholder={placeholder}
            onIonInput={(e) => setDraft(e.detail.value ?? '')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <IonButton size="small" fill="clear" onClick={addItem} disabled={!draft.trim()}>
            <IonIcon slot="icon-only" icon={add} />
          </IonButton>
        </div>
      </IonItem>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {items.map((item) => (
            <IonChip key={item} onClick={() => onChange(items.filter((i) => i !== item))}>
              <IonLabel>{item}</IonLabel>
              <IonIcon icon={close} />
            </IonChip>
          ))}
        </div>
      )}
>>>>>>> origin/main
    </div>
  );
};

<<<<<<< HEAD
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

=======
const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState('');

  // Form durumu — tüm alanlar opsiyonel.
  const [aboutMe, setAboutMe] = useState('');
  const [profession, setProfession] = useState('');
  const [age, setAge] = useState<string>('');
  const [personality, setPersonality] = useState('');
  const [commStyle, setCommStyle] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [sleep, setSleep] = useState('');
  const [primaryGoals, setPrimaryGoals] = useState<string[]>([]);
  const [dailyGoals, setDailyGoals] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [challenge, setChallenge] = useState('');
  const [technique, setTechnique] = useState('');

  const progress = useMemo(() => (step + 1) / TOTAL_STEPS, [step]);

  const buildPayload = (): OnboardingData => {
    const payload: OnboardingData = {};
    if (aboutMe.trim()) payload.about_me = aboutMe.trim();
    if (profession.trim()) payload.profession = profession.trim();
    const ageNum = parseInt(age, 10);
    if (!isNaN(ageNum) && ageNum > 0) payload.age = ageNum;
    if (personality.trim()) payload.personality = personality.trim();
    if (commStyle) payload.communication_style = commStyle;
    if (hobbies.length) payload.hobbies = hobbies;
    if (sleep.trim()) payload.sleep_pattern = sleep.trim();
    if (primaryGoals.length) payload.primary_goals = primaryGoals;
    if (dailyGoals.length) payload.daily_goals = dailyGoals;
    if (weaknesses.length) payload.weaknesses = weaknesses;
    if (challenge) payload.biggest_challenge = challenge;
    if (technique) payload.preferred_technique = technique;
    return payload;
  };

  const submit = async () => {
    setIsSaving(true);
    try {
      const user = await completeOnboarding(buildPayload());
      onComplete(user);
    } catch (err) {
      setToast('Profil kaydedilemedi. Lütfen bağlantını kontrol edip tekrar dene.');
    } finally {
      setIsSaving(false);
    }
  };

  const next = () => (step < TOTAL_STEPS - 1 ? setStep((s) => s + 1) : submit());
  const back = () => setStep((s) => Math.max(0, s - 1));

  const stepTitles = ['Seni tanıyalım', 'Üslup & kişilik', 'Alışkanlıkların', 'Hedeflerin'];

>>>>>>> origin/main
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
<<<<<<< HEAD
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
=======
          <IonTitle>Profilini Oluştur</IonTitle>
        </IonToolbar>
        <IonProgressBar value={progress} />
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', margin: '8px 0 20px' }}>
            <IonText color="medium" style={{ fontSize: '13px' }}>
              Adım {step + 1} / {TOTAL_STEPS}
            </IonText>
            <h2 style={{ margin: '4px 0 0', color: 'var(--ion-color-primary)', fontWeight: 800 }}>
              {stepTitles[step]}
            </h2>
            <IonText color="medium" style={{ fontSize: '13px' }}>
              Bu bilgiler AI koçunun seni tanıması içindir. İstediğini boş bırakabilirsin.
            </IonText>
          </div>

          {/* Adım 1 — Kim olduğun */}
          {step === 0 && (
            <>
              <IonItem lines="full" style={{ marginBottom: '16px', borderRadius: '12px' }}>
                <IonLabel position="stacked">Kendini birkaç cümleyle anlat</IonLabel>
                <IonTextarea
                  value={aboutMe}
                  autoGrow
                  placeholder="Örn: Kendi projelerini geliştiren, öğrenmeyi seven biriyim."
                  onIonInput={(e) => setAboutMe(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" style={{ marginBottom: '16px', borderRadius: '12px' }}>
                <IonLabel position="stacked">Meslek / odak alanı</IonLabel>
                <IonInput
                  value={profession}
                  placeholder="Örn: Yazılım öğrencisi"
                  onIonInput={(e) => setProfession(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" style={{ borderRadius: '12px' }}>
                <IonLabel position="stacked">Yaş</IonLabel>
                <IonInput
                  type="number"
                  value={age}
                  placeholder="Örn: 24"
                  min={1}
                  max={120}
                  onIonInput={(e) => setAge(e.detail.value ?? '')}
                />
              </IonItem>
            </>
          )}

          {/* Adım 2 — Üslup & kişilik */}
          {step === 1 && (
            <>
              <IonItem lines="full" style={{ marginBottom: '16px', borderRadius: '12px' }}>
                <IonLabel position="stacked">Genel olarak nasıl birisin?</IonLabel>
                <IonTextarea
                  value={personality}
                  autoGrow
                  placeholder="Örn: Sakin ama işine gelince disiplinli, detaycı."
                  onIonInput={(e) => setPersonality(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" style={{ borderRadius: '12px' }}>
                <IonLabel position="stacked">Koçun sana nasıl bir üslupla seslensin?</IonLabel>
                <IonSelect
                  value={commStyle}
                  placeholder="Bir üslup seç"
                  onIonChange={(e) => setCommStyle(e.detail.value)}
                >
                  {COMM_STYLES.map((s) => (
                    <IonSelectOption key={s} value={s}>
                      {s}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </>
          )}

          {/* Adım 3 — Alışkanlıklar */}
          {step === 2 && (
            <>
              <ListField
                label="Hobilerin"
                placeholder="Örn: gitar — yazıp Ekle'ye bas"
                items={hobbies}
                onChange={setHobbies}
              />
              <IonItem lines="full" style={{ marginBottom: '16px', borderRadius: '12px' }}>
                <IonLabel position="stacked">Uyku düzenin (saat / süre)</IonLabel>
                <IonInput
                  value={sleep}
                  placeholder="Örn: 00:00 - 08:00, 8 saat düzenli"
                  onIonInput={(e) => setSleep(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" style={{ marginBottom: '16px', borderRadius: '12px' }}>
                <IonLabel position="stacked">Seni en çok zorlayan ne?</IonLabel>
                <IonSelect
                  value={challenge}
                  placeholder="Seç"
                  onIonChange={(e) => setChallenge(e.detail.value)}
                >
                  {CHALLENGES.map((c) => (
                    <IonSelectOption key={c.value} value={c.value}>
                      {c.label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
              <IonItem lines="full" style={{ borderRadius: '12px' }}>
                <IonLabel position="stacked">Tercih ettiğin çalışma tekniği</IonLabel>
                <IonSelect
                  value={technique}
                  placeholder="Seç"
                  onIonChange={(e) => setTechnique(e.detail.value)}
                >
                  {TECHNIQUES.map((t) => (
                    <IonSelectOption key={t.value} value={t.value}>
                      {t.label}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </>
          )}

          {/* Adım 4 — Hedefler */}
          {step === 3 && (
            <>
              <ListField
                label="Yıllık hedeflerin"
                placeholder="Örn: Startup kur — yazıp Ekle'ye bas"
                items={primaryGoals}
                onChange={setPrimaryGoals}
              />
              <ListField
                label="Günlük hedeflerin / rutinin"
                placeholder="Örn: 2 saat kod yaz — yazıp Ekle'ye bas"
                items={dailyGoals}
                onChange={setDailyGoals}
              />
              <ListField
                label="Geliştirmek istediğin yönlerin"
                placeholder="Örn: dikkat dağınıklığı — yazıp Ekle'ye bas"
                items={weaknesses}
                onChange={setWeaknesses}
              />
            </>
          )}

          {/* Gezinme butonları */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
            {step > 0 && (
              <IonButton fill="outline" color="medium" onClick={back} style={{ '--border-radius': '25px' }}>
                <IonIcon slot="start" icon={arrowBack} />
                Geri
              </IonButton>
            )}
            <IonButton
              expand="block"
              onClick={next}
              style={{ flex: 1, '--border-radius': '25px', height: '50px', fontWeight: 'bold' }}
            >
              {step < TOTAL_STEPS - 1 ? (
                <>
                  İleri
                  <IonIcon slot="end" icon={arrowForward} />
                </>
              ) : (
                <>
                  Profili Oluştur
                  <IonIcon slot="end" icon={checkmarkCircle} />
                </>
              )}
            </IonButton>
          </div>

          {step < TOTAL_STEPS - 1 && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <IonText
                color="medium"
                style={{ cursor: 'pointer', fontSize: '13px' }}
                onClick={submit}
              >
                Şimdilik geç, sonra doldururum
              </IonText>
            </div>
          )}
        </div>

        <IonLoading isOpen={isSaving} message="Profilin oluşturuluyor..." />
        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={3000}
          onDidDismiss={() => setToast('')}
          buttons={[{ text: 'Kapat', role: 'cancel' }]}
>>>>>>> origin/main
        />
      </IonContent>
    </IonPage>
  );
};

export default Onboarding;
