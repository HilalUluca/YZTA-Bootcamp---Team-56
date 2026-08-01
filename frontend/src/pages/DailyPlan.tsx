import React, { useState } from 'react';
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
  IonSelect,
  IonSelectOption,
  IonBadge,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import { sparklesOutline, alertCircleOutline, timeOutline, cafeOutline } from 'ionicons/icons';
import api from '../services/api';
import forgeAvatar from '../assets/hmsc/circular-parrot-avatar.jpg';
import leafDecoration from '../assets/hmsc/leaf-tropical-cluster.jpg';
import branchDecoration from '../assets/hmsc/yellow-orange-branch.png';
import sparkleAsset from '../assets/hmsc/sparkle-icon.jpg';
import './DailyPlan.css';

interface DailyPlanProps {
  isOpen: boolean;
  onClose: () => void;
  openTaskCount: number; // açık (yapılacak) görev sayısı
}

// AI'ın döndürdüğü çizelge elemanı (tek ve kusursuz tip tanımı)
interface ScheduleItem {
  block_type?: string; // 'task' | 'break'
  task_name?: string;
  category?: string;
  suggested_duration_minutes?: number;
  priority_score?: number;
  suggestion?: string; // mola önerisi
  duration_minutes?: number; // mola süresi
}

// Öncelik kategorisi → etiket + renk
const categoryInfo = (cat: string): { label: string; color: string } => {
  switch (cat) {
    case 'urgent_important':
      return { label: 'Acil & Önemli', color: 'danger' };
    case 'important':
      return { label: 'Önemli', color: 'warning' };
    case 'urgent':
      return { label: 'Acil', color: 'secondary' };
    default:
      return { label: 'Düşük Öncelik', color: 'medium' };
  }
};

const ENERGIES = [
  { value: 'low', label: 'Düşük', symbol: '🌿', description: 'Sakin tempo' },
  { value: 'medium', label: 'Orta', symbol: '⚡', description: 'Dengeli plan' },
  { value: 'high', label: 'Yüksek', symbol: '🔥', description: 'Yoğun tempo' },
];

const DailyPlan: React.FC<DailyPlanProps> = ({ isOpen, onClose, openTaskCount }) => {
  const [energy, setEnergy] = useState('medium');
  const [hours, setHours] = useState(8);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[] | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [emptyMessage, setEmptyMessage] = useState<string>('');

  const generatePlan = async () => {
    // Açık görev yoksa backend'e hiç gitme; kullanıcıya net yönlendirme ver.
    if (openTaskCount <= 0) {
      setError(null);
      setSummary('');
      setEmptyMessage('Planlanacak açık görevin yok. Önce Görevler sekmesinden birkaç görev ekle, sonra tekrar dene.');
      setSchedule([]);
      return;
    }

    setLoading(true);
    setError(null);
    setSchedule(null);
    setSummary('');
    setEmptyMessage('');
    
    let attempt = 0;
    let success = false;
    while (attempt < 2 && !success) {
      try {
        const res = await api.post('/planner/daily-plan', {
          energy_level: energy,
          available_hours: hours,
        }, { timeout: 30000 });
        
        const data = res.data || {};
        const sched: ScheduleItem[] = data.recommended_schedule || [];
        setSummary(data.summary || '');
        if (sched.length > 0) {
          setSchedule(sched);
        } else {
          // Görev yoksa backend { message, plan: [] } döndürür
          setEmptyMessage(data.message || 'Planlanacak açık görev bulunamadı.');
          setSchedule([]);
        }
        success = true;
      } catch (err: any) {
        attempt++;
        if (attempt >= 2) {
          const detail = err.response?.data?.detail;
          setError(
            typeof detail === 'string'
              ? detail
              : 'Plan oluşturulamadı. AI servisi şu an yanıt veremiyor olabilir, lütfen tekrar dene.'
          );
        }
      }
    }
    setLoading(false);
  };

  const reset = () => {
    setSchedule(null);
    setError(null);
    setSummary('');
    setEmptyMessage('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose} className="daily-plan-modal">
      <IonHeader className="daily-plan-header">
        <IonToolbar className="daily-plan-toolbar">
          <IonButtons slot="start">
            <IonButton onClick={handleClose} className="daily-plan-close">Kapat</IonButton>
          </IonButtons>
          <IonTitle>Bugünün Planı</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="daily-plan-content">
        {/* Yükleniyor */}
        {loading && (
          <div className="daily-plan-state daily-plan-loading">
            <div className="daily-plan-avatar is-thinking">
              <img src={forgeAvatar} alt="Plan hazırlayan Forge" />
              <IonSpinner name="crescent" color="primary" />
            </div>
            <h2>Forge planını hazırlıyor...</h2>
            <p>Görevlerin enerji seviyene ve önceliklerine göre sıralanıyor.</p>
          </div> 
        )}

        {/* Hata */}
        {!loading && error && (
          <div className="daily-plan-state daily-plan-error">
            <span className="daily-plan-state-icon">
              <IonIcon icon={alertCircleOutline} />
            </span>
            <h2>Plan oluşturulamadı</h2>
            <p>{error}</p>
            <IonButton onClick={generatePlan} fill="outline" color="danger" className="daily-plan-secondary-button">
              Tekrar Dene
            </IonButton>
          </div>
        )}

        {/* Kurulum (henüz plan yok) */}
        {!loading && !error && schedule === null && (
          <div className="daily-plan-setup">
            <section className="daily-plan-hero" aria-labelledby="daily-plan-heading">
              <img className="daily-plan-leaf" src={leafDecoration} alt="" aria-hidden="true" />
              <img className="daily-plan-branch" src={branchDecoration} alt="" aria-hidden="true" />
              <div className="daily-plan-hero-copy">
                <span className="daily-plan-kicker">
                  <img src={sparkleAsset} alt="" aria-hidden="true" />
                  Kişisel planın
                </span>
                <h1 id="daily-plan-heading">AI ile Günü Planla</h1>
                <p>Forge, açık görevlerini enerjine ve önceliklerine göre senin için sıralasın.</p>
              </div>
              <img className="daily-plan-forge" src={forgeAvatar} alt="FocusForge maskotu Forge" />
            </section>

            <section className="daily-plan-section" aria-labelledby="energy-heading">
              <div className="daily-plan-section-heading">
                <div>
                  <span className="daily-plan-step">01</span>
                  <h2 id="energy-heading">Enerji seviyen</h2>
                </div>
                <span>Bugün nasılsın?</span>
              </div>
              <div className="daily-plan-energy-grid">
                {ENERGIES.map((e) => (
                  <button
                    key={e.value}
                    type="button"
                    className={`daily-plan-energy ${energy === e.value ? 'is-selected' : ''}`}
                    onClick={() => setEnergy(e.value)}
                    aria-pressed={energy === e.value}
                  >
                    <span className="daily-plan-energy-symbol">{e.symbol}</span>
                    <strong>{e.label}</strong>
                    <small>{e.description}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className="daily-plan-section daily-plan-time-section" aria-labelledby="time-heading">
              <div className="daily-plan-section-heading">
                <div>
                  <span className="daily-plan-step">02</span>
                  <h2 id="time-heading">Müsait süren</h2>
                </div>
                <span>Planın uzunluğu</span>
              </div>
              <IonItem className="daily-plan-time-field" lines="none">
                <span className="daily-plan-time-icon" slot="start">
                  <IonIcon icon={timeOutline} />
                </span>
                <IonLabel>Bugün ayırabileceğin süre</IonLabel>
                <IonSelect
                  value={hours}
                  onIonChange={(e) => setHours(e.detail.value)}
                  interface="popover"
                  aria-label="Bugün ayırabileceğin süre"
                >
                  {[2, 4, 6, 8, 10, 12].map((h) => (
                    <IonSelectOption key={h} value={h}>{h} saat</IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            </section>

            <IonButton expand="block" onClick={generatePlan} className="daily-plan-primary-button">
              <img slot="start" src={sparkleAsset} alt="" aria-hidden="true" />
              Planımı Oluştur
            </IonButton>
            <p className="daily-plan-privacy">✨ Planın birkaç saniye içinde hazır olacak.</p>
          </div>
        )}

        {/* Sonuç */}
        {!loading && !error && schedule !== null && (
          <div className="daily-plan-result">
            <div className="daily-plan-result-heading">
              <img src={forgeAvatar} alt="Forge maskotu" />
              <div>
                <span>Forge hazırladı</span>
                <h1>Bugünkü akışın hazır!</h1>
              </div>
            </div>

            {summary && <div className="daily-plan-summary"><p>{summary}</p></div>}

            {schedule.length === 0 ? (
              <div className="daily-plan-state daily-plan-empty">
                <span className="daily-plan-state-icon"><IonIcon icon={alertCircleOutline} /></span>
                <p>{emptyMessage}</p>
              </div>
            ) : (
              <>
                <div className="daily-plan-schedule">
                  {schedule.map((item, i) => {
                    if (item.block_type === 'break') {
                      return (
                        <div key={`break-${i}`} className="daily-plan-break-card">
                          <span>☕</span>
                          <div>
                            <strong>Kısa mola</strong>
                            <p>{item.suggestion}</p>
                          </div>
                          <b>{item.duration_minutes} dk</b>
                        </div>
                      );
                    }
                    const cat = categoryInfo(item.category || '');
                    return (
                      <div key={i} className="daily-plan-task-card">
                        <div className="daily-plan-task-number">{i + 1}</div>
                        <div className="daily-plan-task-copy">
                          <h3>{item.task_name}</h3>
                          <div className="daily-plan-task-meta">
                            <IonBadge color={cat.color}>{cat.label}</IonBadge>
                            <span><IonIcon icon={timeOutline} />~{item.suggested_duration_minutes} dk</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="daily-plan-tip">💡 Her görev arasında kısa bir mola vermeyi unutma.</p>
              </>
            )}

            <IonButton expand="block" fill="outline" onClick={reset} className="daily-plan-secondary-button">
              Yeni Plan Oluştur
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default DailyPlan;