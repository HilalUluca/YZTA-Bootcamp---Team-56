import React, { useState, useEffect } from 'react';
import {
  IonCard,
  IonModal,
  IonButton,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonSpinner
} from '@ionic/react';
import { moonOutline, closeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { DailySummary, getDailySummaryMock } from '../services/summaryService';
import { useGunSonuZamani } from '../hooks/useGunSonuZamani';
import './GunSonuOzetiCard.css';

export const GunSonuOzetiCard: React.FC = () => {
  const isAfterSummaryTime = useGunSonuZamani();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal gösterim durumu
  const [showModal, setShowModal] = useState(false);
  
  // Kart gösterim durumu (Modal bir kez kapatıldıktan sonra veya "Bugün tekrar gösterme" seçilince)
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    // Sadece saat 20:30 (veya ayarlı saat) geçilmişse veriyi yükle
    if (isAfterSummaryTime) {
      const loadSummary = async () => {
        setLoading(true);
        try {
          const data = await getDailySummaryMock();
          setSummary(data);
          
          // Bugüne ait lokal storage anahtarı (Örn: hasSeenDailySummary_2026-07-27)
          const todayStr = new Date().toLocaleDateString('en-CA'); // Yerel saatle YYYY-MM-DD
          const storageKey = `hasSeenDailySummary_${todayStr}`;
          const hasSeen = localStorage.getItem(storageKey);
          
          if (!hasSeen) {
            // İlk kez görüyorsa modalı aç
            setShowModal(true);
            setShowCard(true); // Modal kapanınca kart olarak kalsın
          } else {
            // Zaten gördüyse ve kapattıysa sadece kartı göster
            setShowCard(true);
          }
        } catch (error) {
          console.error("Gün sonu özeti alınamadı", error);
        } finally {
          setLoading(false);
        }
      };
      
      loadSummary();
    }
  }, [isAfterSummaryTime]);

  const handleDismissModal = (doNotShowAgain: boolean) => {
    setShowModal(false);
    
    if (doNotShowAgain) {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const storageKey = `hasSeenDailySummary_${todayStr}`;
      localStorage.setItem(storageKey, 'true');
    }
  };

  if (!isAfterSummaryTime || (!showModal && !showCard)) {
    return null;
  }

  if (loading) {
    return (
      <IonCard className="gun-sonu-ozeti-card">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <IonSpinner name="dots" />
          <p>Gün sonu özeti hazırlanıyor...</p>
        </div>
      </IonCard>
    );
  }

  if (!summary) return null;

  // Ortak İçerik Bileşeni (Hem kart hem de modal içinde kullanılacak)
  const SummaryContent = () => (
    <div className="gun-sonu-ozeti-content">
      <div className="gso-header">
        <h2>{summary.title}</h2>
        <div className="gso-score">
          Verimlilik: <span>{summary.productivityScore}/100</span>
        </div>
      </div>
      
      <div className="gso-section">
        <h3 className="gso-section-title">Günün Özetleri</h3>
        <ul className="gso-list">
          {summary.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </div>

      <div className="gso-section">
        <h3 className="gso-section-title">Yarın İçin Öneriler</h3>
        <ul className="gso-list">
          {summary.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Modal Görünümü */}
      <IonModal 
        isOpen={showModal} 
        onDidDismiss={() => handleDismissModal(true)}
        className="gso-modal"
        initialBreakpoint={0.75}
        breakpoints={[0, 0.75, 1]}
      >
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IonIcon icon={moonOutline} color="primary" />
                <span>Günün Sona Eriyor</span>
              </div>
            </IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => handleDismissModal(true)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="gso-modal-content">
            <IonIcon icon={checkmarkCircleOutline} className="gso-modal-icon" />
            <h2 className="gso-modal-title">Tebrikler!</h2>
            <p className="gso-modal-text">
              Bugün elinden geleni yaptın. Şimdi dinlenme ve yarın için şarj olma vakti.
            </p>
          </div>
          
          <IonCard className="ff-card" style={{ margin: '0 16px 16px 16px' }}>
            <SummaryContent />
          </IonCard>

          <div className="ion-padding">
            <div className="gso-modal-buttons">
              <button 
                className="ff-btn" 
                onClick={() => handleDismissModal(false)}
              >
                Kapat
              </button>
              <button 
                className="ff-btn ff-btn-ghost" 
                onClick={() => handleDismissModal(true)}
              >
                Bugün Tekrar Gösterme
              </button>
            </div>
          </div>
        </IonContent>
      </IonModal>

      {/* 2. Kart Görünümü (Eğer Modal Kapalıysa) */}
      {showCard && !showModal && (
        <IonCard className="gun-sonu-ozeti-card ff-card ff-rise">
          <SummaryContent />
          <div className="gso-actions ion-padding-horizontal ion-padding-bottom">
            <button className="ff-btn ff-btn-ghost ff-btn-auto" onClick={() => setShowModal(true)}>
              Detayları Gör
            </button>
          </div>
        </IonCard>
      )}
    </>
  );
};
