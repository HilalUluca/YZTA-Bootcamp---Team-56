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
  IonText,
} from '@ionic/react';
import { sparklesOutline, alertCircleOutline, timeOutline } from 'ionicons/icons';
import api from '../services/api';

interface DailyPlanProps {
  isOpen: boolean;
  onClose: () => void;
  openTaskCount: number; // açık (yapılacak) görev sayısı
}

// AI'ın döndürdüğü çizelge elemanı
interface ScheduleItem {
  task_name: string;
  category: string;
  suggested_duration_minutes: number;
  priority_score?: number;
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
  { value: 'low', label: 'Düşük' },
  { value: 'medium', label: 'Orta' },
  { value: 'high', label: 'Yüksek' },
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
    try {
      const res = await api.post('/planner/daily-plan', {
        energy_level: energy,
        available_hours: hours,
      });
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
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Plan oluşturulamadı. AI servisi şu an yanıt veremiyor olabilir, lütfen tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
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
    <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonButton onClick={handleClose}>Kapat</IonButton>
          </IonButtons>
          <IonTitle>Bugünün Planı</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': 'var(--ion-background-color)' }}>
        {/* Yükleniyor */}
        {loading && (
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
            <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(1.6)' }} />
            <h2 style={{ marginTop: '20px', color: 'var(--ion-color-primary)' }}>Forge planını hazırlıyor...</h2>
            <IonText color="medium">Görevlerin önceliğe göre sıralanıyor.</IonText>
          </div>
        )}

        {/* Hata */}
        {!loading && error && (
          <div style={{ textAlign: 'center', marginTop: '60px', color: 'var(--ion-color-danger)' }}>
            <IonIcon icon={alertCircleOutline} style={{ fontSize: '64px' }} />
            <h3>Plan oluşturulamadı</h3>
            <p style={{ color: 'var(--ion-color-medium)' }}>{error}</p>
            <IonButton onClick={generatePlan} fill="outline" color="danger">Tekrar Dene</IonButton>
          </div>
        )}

        {/* Kurulum (henüz plan yok) */}
        {!loading && !error && schedule === null && (
          <div>
            <div style={{ textAlign: 'center', margin: '12px 0 24px 0' }}>
              <IonIcon icon={sparklesOutline} style={{ fontSize: '48px', color: 'var(--ion-color-primary)' }} />
              <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '8px 0 4px 0', color: 'var(--ion-text-color)' }}>
                AI ile Günü Planla
              </h1>
              <IonText color="medium">Forge, açık görevlerini önceliğe göre sıralasın.</IonText>
            </div>

            <IonItem lines="none" style={{ '--background': 'transparent', marginBottom: '4px' }}>
              <IonLabel>Enerji seviyen</IonLabel>
            </IonItem>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              {ENERGIES.map((e) => (
                <IonButton
                  key={e.value}
                  expand="block"
                  fill={energy === e.value ? 'solid' : 'outline'}
                  onClick={() => setEnergy(e.value)}
                  style={{ flex: 1, '--border-radius': '20px' }}
                >
                  {e.label}
                </IonButton>
              ))}
            </div>

            <IonItem style={{ borderRadius: '12px', marginBottom: '28px' }}>
              <IonLabel>Bugün müsait süre</IonLabel>
              <IonSelect value={hours} onIonChange={(e) => setHours(e.detail.value)} interface="popover">
                {[2, 4, 6, 8, 10, 12].map((h) => (
                  <IonSelectOption key={h} value={h}>{h} saat</IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonButton
              expand="block"
              onClick={generatePlan}
              style={{ '--border-radius': '25px', height: '50px', fontWeight: 'bold' }}
            >
              <IonIcon slot="start" icon={sparklesOutline} />
              Plan Oluştur
            </IonButton>
          </div>
        )}

        {/* Sonuç */}
        {!loading && !error && schedule !== null && (
          <div>
            {summary && (
              <div
                style={{
                  background: 'rgba(var(--ion-color-primary-rgb), 0.1)',
                  borderRadius: '14px',
                  padding: '14px',
                  marginBottom: '20px',
                }}
              >
                <p style={{ margin: 0, color: 'var(--ion-text-color)' }}>{summary}</p>
              </div>
            )}

            {schedule.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-medium)' }}>
                <IonIcon icon={alertCircleOutline} style={{ fontSize: '56px' }} />
                <p>{emptyMessage}</p>
              </div>
            ) : (
              <>
                {schedule.map((item, i) => {
                  const cat = categoryInfo(item.category);
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        background: 'var(--ion-card-background, var(--ion-background-color))',
                        border: '1px solid rgba(var(--ion-text-color-rgb, 0,0,0), 0.08)',
                        borderRadius: '14px',
                        padding: '14px',
                        marginBottom: '10px',
                      }}
                    >
                      <div
                        style={{
                          flexShrink: 0,
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'var(--ion-color-primary)',
                          color: 'var(--ion-color-primary-contrast)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px',
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>{item.task_name}</h3>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <IonBadge color={cat.color}>{cat.label}</IonBadge>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                            <IonIcon icon={timeOutline} />
                            ~{item.suggested_duration_minutes} dk
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--ion-color-medium)', marginTop: '16px' }}>
                  💡 Her görev arasında kısa bir mola vermeyi unutma.
                </p>
              </>
            )}

            <IonButton
              expand="block"
              fill="outline"
              onClick={reset}
              style={{ marginTop: '16px', '--border-radius': '25px' }}
            >
              Yeni Plan Oluştur
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default DailyPlan;
