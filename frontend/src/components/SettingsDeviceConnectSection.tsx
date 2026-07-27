import React, { useState, useEffect } from 'react';
import { IonIcon, IonToast } from '@ionic/react';
import { hardwareChipOutline, closeCircleOutline } from 'ionicons/icons';
import { aiSimulationService } from '../services/aiSimulationService';

export const SettingsDeviceConnectSection: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    // Component mount olduğunda durumu kontrol et
    const data = aiSimulationService.getMockDeviceData();
    setIsConnected(!!data);

    // Event listener ile diğer sekmeden yapılan değişiklikleri de yakalayabiliriz
    const handleUpdate = () => {
      const updatedData = aiSimulationService.getMockDeviceData();
      setIsConnected(!!updatedData);
    };

    window.addEventListener('ai-simulation-updated', handleUpdate);
    return () => window.removeEventListener('ai-simulation-updated', handleUpdate);
  }, []);

  const handleConnect = () => {
    aiSimulationService.generateMockDeviceData();
    aiSimulationService.triggerUpdateEvent();
    setIsConnected(true);
    setToastMessage('Cihaz Verileri Bağlandı (Simülasyon)');
  };

  const handleDisconnect = () => {
    aiSimulationService.clearMockDeviceData();
    setIsConnected(false);
    setToastMessage('Bağlantı kesildi.');
  };

  return (
    <>
      <h2 className="ff-section-title" style={{ marginTop: '32px' }}>AI Asistan</h2>
      <div className="ff-card ff-rise" style={{ '--ff-delay': '0.3s' } as React.CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ 
            backgroundColor: isConnected ? 'var(--ion-color-success-tint, #d4f5e1)' : 'var(--ion-color-light)', 
            padding: '10px', 
            borderRadius: '12px',
            color: isConnected ? 'var(--ion-color-success)' : 'var(--ion-color-medium)'
          }}>
            <IonIcon icon={hardwareChipOutline} style={{ fontSize: '24px' }} />
          </div>
          
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 'bold', color: 'var(--ion-color-dark)' }}>
              Cihaz Verilerini Bağla
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--ion-color-medium)', lineHeight: '1.4' }}>
              Uygulama kullanım sürelerini AI ile analiz edip otomatik odak seansları oluşturur.
            </p>
            
            {isConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ion-color-success)' }}>
                  Bağlandı (Simülasyon)
                </span>
                <button 
                  onClick={handleDisconnect}
                  className="ff-btn ff-btn-ghost"
                  style={{ color: 'var(--ion-color-danger)', fontSize: '13px', padding: '4px 8px', minHeight: 'auto' }}
                  aria-label="Cihaz bağlantısını kes"
                >
                  <IonIcon icon={closeCircleOutline} style={{ marginRight: '4px' }} />
                  Bağlantıyı Kes
                </button>
              </div>
            ) : (
              <button 
                onClick={handleConnect}
                className="ff-btn"
                style={{ width: '100%' }}
                aria-label="Cihaz verilerini bağla simülasyonunu başlat"
              >
                Cihaz Verilerini Bağla
              </button>
            )}
          </div>
        </div>
      </div>

      <IonToast 
        isOpen={!!toastMessage} 
        onDidDismiss={() => setToastMessage('')} 
        message={toastMessage} 
        duration={2500} 
      />
    </>
  );
};
