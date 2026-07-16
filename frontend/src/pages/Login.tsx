import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonCard,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonToast,
  IonLoading,
} from '@ionic/react';
import api from '../services/api';
import parrotImg from '../assets/parrot-login.png';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setToastMessage('Lütfen kullanıcı adı ve şifrenizi girin.');
      setShowToast(true);
      return;
    }

    setIsLoading(true);

    try {
      if (isLoginMode) {
        // Giriş Yap
        const response = await api.post('/auth/login', {
          username,
          password,
        });
        const { access_token } = response.data;
        localStorage.setItem('token', access_token);
        setToastMessage('Başarıyla giriş yapıldı!');
        setShowToast(true);
        onLoginSuccess();
      } else {
        // Kayıt Ol
        if (!email) {
          setToastMessage('Lütfen email adresinizi girin.');
          setShowToast(true);
          setIsLoading(false);
          return;
        }
        await api.post('/auth/register', {
          email,
          username,
          password,
          full_name: fullName || null,
        });
        setToastMessage('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
        setShowToast(true);
        setIsLoginMode(true);
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      setToastMessage(typeof detail === 'string' ? detail : JSON.stringify(detail));
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent
        className="ion-padding"
        style={{ '--background': 'var(--ion-background-color)' }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minHeight: '100%',
          }}
        >
          {/* Karşılama görseli: papağan */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <img
              src={parrotImg}
              alt="FocusForge papağanı"
              style={{
                width: '140px',
                height: '140px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 6px 16px rgba(255, 107, 53, 0.35))',
              }}
            />
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 800,
                margin: '8px 0 0 0',
                color: 'var(--ion-color-primary)',
                letterSpacing: '0.5px',
              }}
            >
              FocusForge
            </h1>
            <p
              style={{
                margin: '4px 0 0 0',
                color: 'var(--ion-color-medium)',
                fontSize: '15px',
              }}
            >
              Odaklan, üret, seviye atla 🚀
            </p>
          </div>

          <IonCard
            style={{
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              margin: '16px 0',
            }}
          >
            <IonCardHeader style={{ textAlign: 'center' }}>
              <IonCardTitle style={{ fontSize: '22px', fontWeight: 'bold', color: 'var(--ion-color-primary)' }}>
                {isLoginMode ? 'Tekrar Hoş Geldin!' : 'Aramıza Katıl!'}
              </IonCardTitle>
              <IonCardSubtitle>
                {isLoginMode ? 'Hesabına giriş yap ve odaklanmaya başla.' : 'Kişisel AI verimlilik asistanını oluştur.'}
              </IonCardSubtitle>
            </IonCardHeader>

            <IonCardContent>
              <form onSubmit={handleSubmit}>
                {!isLoginMode && (
                  <>
                    <IonItem style={{ marginBottom: '16px' }}>
                      <IonLabel position="stacked">Ad Soyad</IonLabel>
                      <IonInput
                        value={fullName}
                        placeholder="Adınızı ve soyadınızı girin"
                        onIonInput={(e) => setFullName(e.detail.value!)}
                      />
                    </IonItem>

                    <IonItem style={{ marginBottom: '16px' }}>
                      <IonLabel position="stacked">E-posta *</IonLabel>
                      <IonInput
                        type="email"
                        value={email}
                        placeholder="E-posta adresinizi girin"
                        onIonInput={(e) => setEmail(e.detail.value!)}
                      />
                    </IonItem>
                  </>
                )}

                <IonItem style={{ marginBottom: '16px' }}>
                  <IonLabel position="stacked">Kullanıcı Adı *</IonLabel>
                  <IonInput
                    value={username}
                    placeholder="Kullanıcı adınızı girin"
                    onIonInput={(e) => setUsername(e.detail.value!)}
                  />
                </IonItem>

                <IonItem style={{ marginBottom: '16px' }}>
                  <IonLabel position="stacked">Şifre *</IonLabel>
                  <IonInput
                    type="password"
                    value={password}
                    placeholder="Şifrenizi girin"
                    onIonInput={(e) => setPassword(e.detail.value!)}
                  />
                </IonItem>

                <IonButton
                  expand="block"
                  type="submit"
                  style={{
                    marginTop: '24px',
                    height: '50px',
                    '--border-radius': '25px',
                    '--box-shadow': '0 6px 18px rgba(var(--ion-color-primary-rgb), 0.4)',
                    fontWeight: 'bold',
                    fontSize: '16px',
                  }}
                >
                  {isLoginMode ? 'Giriş Yap' : 'Kayıt Ol'}
                </IonButton>

                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <IonText
                    color="medium"
                    style={{ cursor: 'pointer', fontSize: '14px' }}
                    onClick={() => setIsLoginMode(!isLoginMode)}
                  >
                    {isLoginMode
                      ? 'Hesabın yok mu? Kayıt Ol'
                      : 'Zaten üye misin? Giriş Yap'}
                  </IonText>
                </div>
              </form>
            </IonCardContent>
          </IonCard>
        </div>

        <IonLoading isOpen={isLoading} message={'Lütfen bekleyin...'} />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
          buttons={[
            {
              text: 'Kapat',
              role: 'cancel',
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
