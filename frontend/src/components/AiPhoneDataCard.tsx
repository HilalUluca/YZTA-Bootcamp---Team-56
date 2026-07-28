import React, { useState, useEffect } from 'react';
import { IonIcon, IonToast } from '@ionic/react';
import { hardwareChipOutline, phonePortraitOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import { aiSimulationService, DeviceUsageMock, AiInsight } from '../services/aiSimulationService';

export const AiPhoneDataCard: React.FC = () => {
  const [deviceData, setDeviceData] = useState<DeviceUsageMock | null>(null);
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const loadData = () => {
    const data = aiSimulationService.getMockDeviceData();
    setDeviceData(data);
    if (data) {
      setInsight(aiSimulationService.getAiInsight(data));
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener('ai-simulation-updated', handleUpdate);
    return () => window.removeEventListener('ai-simulation-updated', handleUpdate);
  }, []);

  const handleAiPlan = () => {
    if (deviceData) {
      // Sadece yeni plan yoksa oluşturmaya izin ver ya da üzerine yazdığına dair toast göster (AiSimulationService'de çözeceğiz)
      const success = aiSimulationService.generateAiPlan(deviceData);

      if (success) {
        setToastMessage('Plan başarıyla oluşturuldu.');
        aiSimulationService.triggerUpdateEvent(); // Liste bileşenini tetikle
      } else {
        setToastMessage('Plan zaten mevcut. Önce mevcut planı temizleyin.');
      }
    }
  };

  if (!deviceData || !insight) {
    return null; // Veri yoksa kartı hiç gösterme
  }

  return (
    <>
      <div className="ff-card ff-rise" style={{ marginBottom: '20px', borderLeft: '4px solid var(--ion-color-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: 'var(--ion-color-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IonIcon icon={hardwareChipOutline} color="secondary" />
            AI Telefon Verileri
          </h2>
          <span style={{ fontSize: '11px', backgroundColor: 'var(--ion-color-light)', padding: '2px 8px', borderRadius: '12px', color: 'var(--ion-color-medium)' }}>
            SİMÜLASYON
          </span>
        </div>

        <div style={{ backgroundColor: 'var(--ion-color-warning-tint, #fff3cd)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <IonIcon icon={alertCircleOutline} style={{ color: 'var(--ion-color-warning)', fontSize: '20px', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '14px', color: 'var(--ion-color-dark)' }}>
              Bugün <strong>{deviceData.unproductiveHours} saat</strong> dikkat dağıtan kullanım tespit edildi.
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--ion-color-dark)', fontWeight: 600 }}>
              Bu süreyle yaklaşık {insight.potentialPomodoroCount} Pomodoro tamamlayabilirdin!
            </p>
          </div>
        </div>

        {showDetails && (
          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--ion-color-light)', paddingTop: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 10px', color: 'var(--ion-color-dark)' }}>Dikkat Dağıtan Uygulamalar</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {deviceData.topDistractingApps.map((app, index) => (
                <li key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px', color: 'var(--ion-color-medium)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IonIcon icon={phonePortraitOutline} />
                    {app.name}
                  </span>
                  <span>{app.minutes} dk</span>
                </li>
              ))}
            </ul>

            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '16px 0 10px', color: 'var(--ion-color-dark)' }}>Bugünkü Boşluklar</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {deviceData.freeTimeSlots.map((slot, idx) => (
                <span key={idx} style={{ fontSize: '12px', backgroundColor: 'var(--ion-color-light)', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonIcon icon={timeOutline} />
                  {slot.start} - {slot.end}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="ff-btn"
            style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            onClick={handleAiPlan}
          >
            <IonIcon icon={hardwareChipOutline} />
            AI Planla
          </button>

          <button
            className="ff-btn ff-btn-ghost"
            style={{ padding: '0 12px' }}
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? 'Gizle' : 'Detayları Gör'}
          </button>
        </div>
      </div>

      <IonToast
        isOpen={!!toastMessage}
        onDidDismiss={() => setToastMessage('')}
        message={toastMessage}
        duration={2000}
      />
    </>
  );
};
