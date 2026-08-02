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
      <div className={`profile-device-card ff-rise ${isConnected ? 'is-connected' : ''}`}>
        <span className="profile-device-icon"><IonIcon icon={hardwareChipOutline} /></span>
        <div className="profile-device-content">
            <h3>
              Cihaz Verilerini Bağla
            </h3>
            <p>
              Uygulama kullanım sürelerini AI ile analiz edip otomatik odak seansları oluşturur.
            </p>

            {isConnected ? (
              <div className="profile-device-actions">
                <span className="profile-device-status">
                  Bağlandı (Simülasyon)
                </span>
                <button
                  onClick={handleDisconnect}
                  className="profile-device-disconnect"
                  aria-label="Cihaz bağlantısını kes"
                >
                  <IonIcon icon={closeCircleOutline} />
                  Bağlantıyı Kes
                </button>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="profile-device-connect"
                aria-label="Cihaz verilerini bağla simülasyonunu başlat"
              >
                Bağla
              </button>
            )}
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
