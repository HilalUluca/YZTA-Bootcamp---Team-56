import React, { useState } from 'react';
import {
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonSpinner,
  IonBadge,
  IonText,
} from '@ionic/react';
import { sparklesOutline, alertCircleOutline, chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import api from '../services/api';

// Backend'in döndürdüğü görev yapısı (POST /api/tasks/prioritize)
interface PrioritizedTask {
  task_name: string;
  priority_score: number;
  ai_reasoning: string;
  eisenhower_category: string;
}

// 4 kadran: sıra Eisenhower okuma sırasına göre
const QUADRANTS = [
  { key: 'urgent_important', title: 'Acil & Önemli', action: 'Hemen yap', color: 'danger' },
  { key: 'important', title: 'Önemli', action: 'Planla', color: 'warning' },
  { key: 'urgent', title: 'Acil', action: 'Devret', color: 'secondary' },
  { key: 'low', title: 'Düşük Öncelik', action: 'Sonraya bırak', color: 'medium' },
];

const EisenhowerMatrix: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PrioritizedTask[] | null>(null);
  const [summary, setSummary] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null); // açık olan gerekçe

  const prioritize = async () => {
    setLoading(true);
    setError(null);
    setTasks(null);
    setSummary('');
    try {
      const res = await api.post('/tasks/prioritize', {});
      const data = res.data || {};
      // Backend anahtarı: "tasks" (prioritized_tasks DEĞİL)
      setTasks(data.tasks || []);
      setSummary(data.summary || '');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : 'Önceliklendirme yapılamadı. Lütfen biraz sonra tekrar dene.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Yükleniyor
  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '60px' }}>
        <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(1.6)' }} />
        <h2 style={{ marginTop: '20px', color: 'var(--ion-color-primary)' }}>Forge görevlerini sıralıyor...</h2>
        <IonText color="medium">Aciliyet ve önem analiz ediliyor.</IonText>
      </div>
    );
  }

  // Hata
  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-danger)' }}>
        <IonIcon icon={alertCircleOutline} style={{ fontSize: '56px' }} />
        <h3>Önceliklendirme yapılamadı</h3>
        <p style={{ color: 'var(--ion-color-medium)' }}>{error}</p>
        <IonButton onClick={prioritize} fill="outline" color="danger">Tekrar Dene</IonButton>
      </div>
    );
  }

  // Henüz çalıştırılmadı
  if (tasks === null) {
    return (
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <IonIcon icon={sparklesOutline} style={{ fontSize: '48px', color: 'var(--ion-color-primary)' }} />
        <h2 style={{ fontWeight: 800, margin: '8px 0 4px 0' }}>Eisenhower Matrisi</h2>
        <IonText color="medium">
          Forge açık görevlerini aciliyet ve öneme göre 4 kadrana ayırsın.
        </IonText>
        <IonButton
          expand="block"
          onClick={prioritize}
          style={{ marginTop: '24px', '--border-radius': '25px', height: '50px', fontWeight: 'bold' }}
        >
          <IonIcon slot="start" icon={sparklesOutline} />
          Önceliklendir
        </IonButton>
      </div>
    );
  }

  // Sonuç: 4 kadran
  return (
    <div>
      {summary && (
        <div
          style={{
            background: 'rgba(var(--ion-color-primary-rgb), 0.1)',
            borderRadius: '14px',
            padding: '14px',
            marginBottom: '16px',
          }}
        >
          <p style={{ margin: 0, color: 'var(--ion-text-color)' }}>{summary}</p>
        </div>
      )}

      {/* Mobilde alt alta (size=12), geniş ekranda 2x2 (sizeMd=6) */}
      <IonGrid style={{ padding: 0 }}>
        <IonRow>
          {QUADRANTS.map((q) => {
            const items = tasks.filter((t) => t.eisenhower_category === q.key);
            return (
              <IonCol size="12" sizeMd="6" key={q.key} style={{ padding: '6px' }}>
                <IonCard style={{ borderRadius: '16px', margin: 0, height: '100%' }}>
                  {/* Kadran başlığı */}
                  <div
                    style={{
                      background: `var(--ion-color-${q.color})`,
                      color: `var(--ion-color-${q.color}-contrast)`,
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{q.title}</div>
                      <div style={{ fontSize: '11px', opacity: 0.9 }}>{q.action}</div>
                    </div>
                    <IonBadge color="light">{items.length}</IonBadge>
                  </div>

                  <IonCardContent style={{ padding: '10px 14px' }}>
                    {items.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                        Bu kadranda görev yok.
                      </p>
                    ) : (
                      items.map((t, i) => {
                        const id = `${q.key}-${i}`;
                        const acik = expanded === id;
                        return (
                          <div
                            key={id}
                            onClick={() => setExpanded(acik ? null : id)}
                            style={{
                              padding: '8px 0',
                              borderBottom: i < items.length - 1 ? '1px solid rgba(var(--ion-text-color-rgb,0,0,0),0.08)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <span style={{ flex: 1, fontWeight: 500 }}>{t.task_name}</span>
                              {t.ai_reasoning && (
                                <IonIcon
                                  icon={acik ? chevronUpOutline : chevronDownOutline}
                                  style={{ color: 'var(--ion-color-medium)', flexShrink: 0, marginTop: '3px' }}
                                />
                              )}
                            </div>
                            {acik && t.ai_reasoning && (
                              <p
                                style={{
                                  margin: '8px 0 2px 0',
                                  fontSize: '13px',
                                  color: 'var(--ion-color-medium)',
                                  lineHeight: 1.5,
                                }}
                              >
                                💡 {t.ai_reasoning}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </IonCardContent>
                </IonCard>
              </IonCol>
            );
          })}
        </IonRow>
      </IonGrid>

      <IonButton
        expand="block"
        fill="outline"
        onClick={prioritize}
        style={{ marginTop: '12px', '--border-radius': '25px' }}
      >
        <IonIcon slot="start" icon={sparklesOutline} />
        Yeniden Önceliklendir
      </IonButton>
    </div>
  );
};

export default EisenhowerMatrix;
