import React, { useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonProgressBar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonAvatar,
  IonToast,
  IonLoading,
} from '@ionic/react';
import { logOutOutline, personCircleOutline, shieldCheckmarkOutline, trophyOutline } from 'ionicons/icons';
import './Tab3.css';

interface UserProfile {
  username: string;
  email: string;
  full_name?: string;
  level: number;
  total_xp: number;
  responsibility_score: number;
}

interface Tab3Props {
  onLogout: () => void;
}

const Tab3: React.FC<Tab3Props> = ({ onLogout }) => {
  const [profile] = useState<UserProfile | null>({
    username: 'test_user',
    email: 'test@example.com',
    full_name: 'Test User',
    level: 3,
    total_xp: 2450,
    responsibility_score: 85,
  });
  const [isLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  // XP çubuğu için ilerleme oranı (örneğin her seviye için 1000 XP gerektiğini varsayalım)
  const xpNeeded = 1000;
  const currentLevelXp = profile ? profile.total_xp % xpNeeded : 0;
  const xpProgress = profile ? currentLevelXp / xpNeeded : 0;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Profilim</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonLoading isOpen={isLoading} message="Yükleniyor..." />

        {profile && (
          <div>
            {/* Profil Kartı */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0' }}>
              <IonAvatar style={{ width: '96px', height: '96px', marginBottom: '12px' }}>
                <IonIcon icon={personCircleOutline} style={{ width: '100%', height: '100%', color: 'var(--ion-color-primary)' }} />
              </IonAvatar>
              <h2 style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>
                {profile.full_name || profile.username}
              </h2>
              <p style={{ color: 'var(--ion-color-medium)', margin: 0 }}>@{profile.username}</p>
            </div>

            {/* İstatistikler */}
            <IonCard style={{ borderRadius: '12px', marginBottom: '16px' }}>
              <IonCardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={trophyOutline} color="warning" style={{ fontSize: '24px' }} />
                  <IonCardTitle style={{ fontSize: '20px' }}>Seviye & XP</IonCardTitle>
                </div>
                <IonCardSubtitle>Görevleri tamamla ve seviye atla!</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                  <span>Seviye {profile.level}</span>
                  <span>{currentLevelXp} / {xpNeeded} XP</span>
                </div>
                <IonProgressBar value={xpProgress} color="warning" style={{ height: '8px', borderRadius: '4px' }} />
              </IonCardContent>
            </IonCard>

            <IonCard style={{ borderRadius: '12px', marginBottom: '24px' }}>
              <IonCardHeader>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IonIcon icon={shieldCheckmarkOutline} color="secondary" style={{ fontSize: '24px' }} />
                  <IonCardTitle style={{ fontSize: '20px' }}>Sorumluluk Skoru</IonCardTitle>
                </div>
                <IonCardSubtitle>AI koçunun senin hakkında verdiği kararlılık puanı.</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                  <span>Kararlılık Puanı</span>
                  <span>%{profile.responsibility_score.toFixed(0)}</span>
                </div>
                <IonProgressBar value={profile.responsibility_score / 100} color="secondary" style={{ height: '8px', borderRadius: '4px' }} />
              </IonCardContent>
            </IonCard>

            {/* Diğer Bilgiler */}
            <IonList inset style={{ borderRadius: '12px', marginBottom: '24px' }}>
              <IonItem>
                <IonLabel>
                  <p>Kullanıcı Adı</p>
                  <h3>{profile.username}</h3>
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel>
                  <p>E-posta Adresi</p>
                  <h3>{profile.email}</h3>
                </IonLabel>
              </IonItem>
            </IonList>

            {/* Çıkış Yap Butonu */}
            <IonButton
              expand="block"
              color="danger"
              fill="outline"
              onClick={onLogout}
              style={{ '--border-radius': '10px', fontWeight: 'bold', marginTop: '32px' }}
            >
              <IonIcon slot="start" icon={logOutOutline} />
              Çıkış Yap
            </IonButton>
          </div>
        )}

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
        />
      </IonContent>
    </IonPage>
  );
};

export default Tab3;

