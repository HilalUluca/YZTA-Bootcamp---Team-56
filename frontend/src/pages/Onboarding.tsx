import React, { useMemo, useState } from 'react';
import {
  IonButton,
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
import forgeThinking from '../assets/forge-thinking.png';
import forgeNeutral from '../assets/forge-neutral.png';
import forgeHappy from '../assets/forge-happy.png';
import './Onboarding.css';

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

const STEP_MESSAGES = [
  'Seni biraz tanıyayım; böylece önerilerimi sana göre şekillendirebilirim.',
  'Nasıl konuşmamı istediğini seç, aynı ekiptenmişiz gibi ilerleyelim.',
  'Günlük düzenini öğrenirsem sana daha gerçekçi öneriler sunabilirim.',
  'Harika gidiyorsun! Son olarak ulaşmak istediğin hedefleri birlikte netleştirelim.',
];

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
    </div>
  );
};

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
  const mascotSrc =
    step === 0 ? forgeThinking : step === TOTAL_STEPS - 1 ? forgeHappy : forgeNeutral;
  const mascotState =
    step === 0 ? 'is-thinking' : step === TOTAL_STEPS - 1 ? 'is-happy' : 'is-neutral';

  return (
    <IonPage className="onboarding-page">
      <IonHeader className="onboarding-header">
        <IonToolbar>
          <IonTitle>Profilini Oluştur</IonTitle>
        </IonToolbar>
        <IonProgressBar value={progress} />
      </IonHeader>

      <IonContent className="onboarding-content">
        <div className="onboarding-shell">
          <aside className={`onboarding-forge-card ${step === TOTAL_STEPS - 1 ? 'is-happy' : ''}`}>
            <div className="onboarding-mascot-frame" aria-hidden="true">
              <img
                src={mascotSrc}
                alt=""
                className={`onboarding-mascot ${mascotState}`}
              />
            </div>
            <div className="onboarding-forge-copy">
              <span className="onboarding-forge-name">Forge</span>
              <p>{STEP_MESSAGES[step]}</p>
            </div>
          </aside>

          <main className="onboarding-form-card ff-card">
            <div className="onboarding-step-heading">
            <IonText color="medium" style={{ fontSize: '13px' }}>
              Adım {step + 1} / {TOTAL_STEPS}
            </IonText>
            <h2>
              {stepTitles[step]}
            </h2>
            <IonText color="medium" style={{ fontSize: '13px' }}>
              Bu bilgiler AI koçunun seni tanıması içindir. İstediğini boş bırakabilirsin.
            </IonText>
          </div>

          {/* Adım 1 — Kim olduğun */}
          {step === 0 && (
            <>
              <IonItem lines="full" className="onboarding-field">
                <IonLabel position="stacked">Kendini birkaç cümleyle anlat</IonLabel>
                <IonTextarea
                  value={aboutMe}
                  autoGrow
                  placeholder="Örn: Kendi projelerini geliştiren, öğrenmeyi seven biriyim."
                  onIonInput={(e) => setAboutMe(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" className="onboarding-field">
                <IonLabel position="stacked">Meslek / odak alanı</IonLabel>
                <IonInput
                  value={profession}
                  placeholder="Örn: Yazılım öğrencisi"
                  onIonInput={(e) => setProfession(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" className="onboarding-field">
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
              <IonItem lines="full" className="onboarding-field">
                <IonLabel position="stacked">Genel olarak nasıl birisin?</IonLabel>
                <IonTextarea
                  value={personality}
                  autoGrow
                  placeholder="Örn: Sakin ama işine gelince disiplinli, detaycı."
                  onIonInput={(e) => setPersonality(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" className="onboarding-field">
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
              <IonItem lines="full" className="onboarding-field">
                <IonLabel position="stacked">Uyku düzenin (saat / süre)</IonLabel>
                <IonInput
                  value={sleep}
                  placeholder="Örn: 00:00 - 08:00, 8 saat düzenli"
                  onIonInput={(e) => setSleep(e.detail.value ?? '')}
                />
              </IonItem>
              <IonItem lines="full" className="onboarding-field">
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
              <IonItem lines="full" className="onboarding-field">
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
          <div className="onboarding-actions">
            {step > 0 && (
              <IonButton fill="outline" color="medium" onClick={back} className="onboarding-back">
                <IonIcon slot="start" icon={arrowBack} />
                Geri
              </IonButton>
            )}
            <IonButton
              expand="block"
              onClick={next}
              className="onboarding-next"
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
            <div className="onboarding-skip">
              <IonText
                color="medium"
                style={{ cursor: 'pointer', fontSize: '13px' }}
                onClick={submit}
              >
                Şimdilik geç, sonra doldururum
              </IonText>
            </div>
          )}
          </main>
        </div>

        <IonLoading isOpen={isSaving} message="Profilin oluşturuluyor..." />
        <IonToast
          isOpen={!!toast}
          message={toast}
          duration={3000}
          onDidDismiss={() => setToast('')}
          buttons={[{ text: 'Kapat', role: 'cancel' }]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Onboarding;
