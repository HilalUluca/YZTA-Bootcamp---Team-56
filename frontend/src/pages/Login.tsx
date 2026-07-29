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
import { login as loginRequest, register as registerRequest } from '../services/authService';
import parrotImg from '../assets/parrot-login.png';

interface LoginProps {
  onLoginSuccess: () => void;
}

// Backend kuralları (app/schemas/user.py ile birebir):
// şifre en az 6, kullanıcı adı en az 3 karakter.
const MIN_PASSWORD = 6;
const MIN_USERNAME = 3;

// Backend / doğrulama hatalarını kullanıcı dostu Türkçe mesaja çevirir.
const friendlyError = (error: any): string => {
  const detail = error?.response?.data?.detail;

  // FastAPI/Pydantic doğrulama hatası: detail bir dizidir (ham/teknik mesaj burada).
  if (Array.isArray(detail)) {
    const first = detail[0];
    const field = Array.isArray(first?.loc) ? String(first.loc[first.loc.length - 1]) : '';
    const min = first?.ctx?.min_length;
    if (field === 'password') return `Şifre en az ${min ?? MIN_PASSWORD} karakter olmalı.`;
    if (field === 'username') return `Kullanıcı adı en az ${min ?? MIN_USERNAME} karakter olmalı.`;
    if (field === 'email') return 'Lütfen geçerli bir e-posta adresi gir.';
    return 'Girdiğin bilgileri kontrol et.';
  }

  // Backend zaten Türkçe bir mesaj döndürdüyse (ör. "Bu kullanıcı adı zaten alınmış") onu göster.
  if (typeof detail === 'string' && detail.trim()) return detail;

  return 'Bir sorun oluştu. Lütfen tekrar dene.';
};

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const notify = (m: string) => {
    setToastMessage(m);
    setShowToast(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUser = username.trim();

    // --- İstemci tarafı doğrulama (backend'e gitmeden dostça uyar) ---
    if (!trimmedUser || !password) {
      notify('Lütfen kullanıcı adı ve şifreni gir.');
      return;
    }

    if (!isLoginMode) {
      if (!email.trim()) {
        notify('Lütfen e-posta adresini gir.');
        return;
      }
      if (trimmedUser.length < MIN_USERNAME) {
        notify(`Kullanıcı adı en az ${MIN_USERNAME} karakter olmalı.`);
        return;
      }
      if (password.length < MIN_PASSWORD) {
        notify(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isLoginMode) {
        // Giriş Yap — servis token'ı localStorage'a yazar.
        await loginRequest({ username: trimmedUser, password });
        onLoginSuccess();
      } else {
        // Kayıt Ol
        await registerRequest({
          email: email.trim(),
          username: trimmedUser,
          password,
          full_name: fullName.trim() || null,
        });
        notify('Kaydın oluşturuldu. Şimdi giriş yapabilirsin.');
        setIsLoginMode(true);
        setPassword('');
      }
    } catch (error) {
      notify(friendlyError(error));
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
                        placeholder="Adını ve soyadını gir"
                        onIonInput={(e) => setFullName(e.detail.value!)}
                      />
                    </IonItem>

                    <IonItem style={{ marginBottom: '16px' }}>
                      <IonLabel position="stacked">E-posta *</IonLabel>
                      <IonInput
                        type="email"
                        value={email}
                        placeholder="ornek@posta.com"
                        onIonInput={(e) => setEmail(e.detail.value!)}
                      />
                    </IonItem>
                  </>
                )}

                <IonItem style={{ marginBottom: '16px' }}>
                  <IonLabel position="stacked">Kullanıcı Adı *</IonLabel>
                  <IonInput
                    value={username}
                    placeholder="Kullanıcı adını gir"
                    onIonInput={(e) => setUsername(e.detail.value!)}
                  />
                </IonItem>

                <IonItem style={{ marginBottom: !isLoginMode ? '6px' : '16px' }}>
                  <IonLabel position="stacked">Şifre *</IonLabel>
                  <IonInput
                    type="password"
                    value={password}
                    placeholder={isLoginMode ? 'Şifreni gir' : 'En az 6 karakter'}
                    onIonInput={(e) => setPassword(e.detail.value!)}
                  />
                </IonItem>
                {!isLoginMode && (
                  <IonText
                    color="medium"
                    style={{ display: 'block', fontSize: '12px', margin: '0 0 16px 4px' }}
                  >
                    Şifre en az {MIN_PASSWORD} karakter olmalı.
                  </IonText>
                )}

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
