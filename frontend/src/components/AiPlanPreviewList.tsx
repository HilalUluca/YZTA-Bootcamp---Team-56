import React, { useState, useEffect } from 'react';
import { IonIcon } from '@ionic/react';
import { trashOutline, flameOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { aiSimulationService, FocusTaskPlan } from '../services/aiSimulationService';

export const AiPlanPreviewList: React.FC = () => {
  const [plans, setPlans] = useState<FocusTaskPlan[]>([]);

  const loadPlans = () => {
    const data = aiSimulationService.getAiGeneratedPlan();
    setPlans(data || []);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    // Custom event ile diğer bileşenlerden (örn. Settings'den bağlantı kesilince) haber alma
    const handleUpdate = () => {
      loadPlans();
    };

    window.addEventListener('ai-simulation-updated', handleUpdate);
    return () => window.removeEventListener('ai-simulation-updated', handleUpdate);
  }, []);

  const handleDelete = (id: string) => {
    const updated = aiSimulationService.deletePlanItem(id);
    setPlans(updated);
  };

  if (plans.length === 0) {
    return null; // Plan yoksa liste hiç görünmesin
  }

  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 className="ff-section-title" style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <IonIcon icon={flameOutline} color="primary" />
        AI Tarafından Oluşturulan Plan (Simülasyon)
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className="ff-row ff-rise" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: 'var(--ion-color-light)',
              borderRadius: '12px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
              <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '24px', color: 'var(--ion-color-medium)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 600, color: 'var(--ion-color-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {plan.title}
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: 'var(--ion-color-medium)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {plan.start} - {plan.end}
                  </span>
                  {plan.pomodoroCount && (
                    <span style={{ fontSize: '12px', backgroundColor: 'var(--ion-color-primary-tint, #e6f0ff)', color: 'var(--ion-color-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                      {plan.pomodoroCount} Pomodoro
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => handleDelete(plan.id)}
              style={{ background: 'none', border: 'none', color: 'var(--ion-color-danger)', fontSize: '20px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              aria-label="Planı Sil"
            >
              <IonIcon icon={trashOutline} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
