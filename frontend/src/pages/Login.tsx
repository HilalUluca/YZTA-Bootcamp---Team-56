import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonIcon,
  IonToast,
  IonLoading,
} from '@ionic/react';
import {
  sparkles,
  personOutline,
  atCircleOutline,
  mailOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  arrowForward,
  logoGoogle,
  logoApple,
  checkmark,
} from 'ionicons/icons';
import { login as loginRequest, register as registerRequest } from '../services/authService';
import parrotHero from '../assets/parrot-wave.png';
import './Login.css';

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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Şifre göster/gizle
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const notify = (m: string) => {
    setToastMessage(m);
    setShowToast(true);
  };

  // Mod değişince moda özel alanları temizle (kalıntı doğrulama olmasın).
  const switchMode = () => {
    setIsLoginMode((prev) => !prev);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirm(false);
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
      if (confirmPassword !== password) {
        notify('Şifreler eşleşmiyor. Lütfen kontrol et.');
        return;
      }
      if (!acceptTerms) {
        notify('Devam etmek için kullanım koşullarını kabul etmelisin.');
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
        setConfirmPassword('');
      }
    } catch (error) {
      notify(friendlyError(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Google/Apple: backend'de OAuth henüz yok → görsel dursun, tıklayınca bilgi ver.
  const socialSoon = (provider: string) => {
    notify(`${provider} ile giriş çok yakında eklenecek. 🚧`);
  };

  const actionLabel = isLoginMode ? 'Giriş Yap' : 'Kayıt Ol';

  return (
    <IonPage className="ff-page login-page">
      {/* Uygulama geneliyle aynı ambient arka plan */}
      <div className="ff-aurora" />

      <IonContent className="lp-content">
        <div className="lp-wrap">
          {/* --- Başlık + papağan --- */}
          <div className="lp-hero ff-rise">
            <span className="lp-brand">
              <IonIcon icon={sparkles} />
              AI Koçun
            </span>

            <h1 className="lp-title">
              {isLoginMode ? 'Tekrar hoş geldin! 👋' : 'Aramıza hoş geldin! 👋'}
            </h1>
            <p className="lp-sub">
              {isLoginMode
                ? 'Hesabına giriş yap ve hedeflerine kaldığın yerden devam et.'
                : 'Hedeflerine giden yolculuğuna başlayalım. Birlikte başaramayacağımız şey yok!'}
            </p>

            {/* Sahne: papağan kartın üstüne "tünüyormuş" gibi dursun diye iki katman.
                Katman 1 (arka) tam papağan — kart bunun önüne biner.
                Katman 2 (ön) sadece ayak/pençe bandı — kartın ÖNÜNDE kalır,
                böylece pençe uçları kutunun önüne taşar. */}
            <div className="lp-hero-stage">
              <div className="lp-parrot-wrap">
                <img className="lp-parrot" src={parrotHero} alt="FocusForge papağanı" />
              </div>
              <div className="lp-feet-layer" aria-hidden="true">
                <img className="lp-parrot lp-parrot--feet" src={parrotHero} alt="" />
              </div>
            </div>
          </div>

          {/* --- Form kartı --- */}
          <div className="lp-card ff-rise">
            <form onSubmit={handleSubmit}>
              {!isLoginMode && (
                <div className="lp-field-gap">
                  <label className="lp-label">Ad Soyad</label>
                  <div className="lp-field">
                    <IonIcon className="lp-lead-icon" icon={personOutline} />
                    <IonInput
                      className="lp-input"
                      value={fullName}
                      placeholder="Adınız ve soyadınız"
                      onIonInput={(e) => setFullName(e.detail.value!)}
                    />
                  </div>
                </div>
              )}

              {/* Kullanıcı adı — backend hem giriş hem kayıtta zorunlu tutuyor */}
              <div className="lp-field-gap">
                <label className="lp-label">Kullanıcı Adı</label>
                <div className="lp-field">
                  <IonIcon
                    className="lp-lead-icon"
                    icon={isLoginMode ? personOutline : atCircleOutline}
                  />
                  <IonInput
                    className="lp-input"
                    value={username}
                    placeholder="Kullanıcı adını gir"
                    onIonInput={(e) => setUsername(e.detail.value!)}
                  />
                </div>
              </div>

              {!isLoginMode && (
                <div className="lp-field-gap">
                  <label className="lp-label">E-posta</label>
                  <div className="lp-field">
                    <IonIcon className="lp-lead-icon" icon={mailOutline} />
                    <IonInput
                      className="lp-input"
                      type="email"
                      value={email}
                      placeholder="ornek@mail.com"
                      onIonInput={(e) => setEmail(e.detail.value!)}
                    />
                  </div>
                </div>
              )}

              {/* Şifre */}
              <div className={isLoginMode ? 'lp-field-gap' : ''}>
                <label className="lp-label">Şifre</label>
                <div className="lp-field">
                  <IonIcon className="lp-lead-icon" icon={lockClosedOutline} />
                  <IonInput
                    className="lp-input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    placeholder={isLoginMode ? 'Şifreni gir' : 'En az 6 karakter'}
                    onIonInput={(e) => setPassword(e.detail.value!)}
                  />
                  <button
                    type="button"
                    className="lp-eye"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                  </button>
                </div>
                {!isLoginMode && (
                  <span className="lp-hint">Şifre en az {MIN_PASSWORD} karakter olmalı.</span>
                )}
              </div>

              {/* Şifre Tekrar — sadece kayıt modunda */}
              {!isLoginMode && (
                <div className="lp-field-gap" style={{ marginTop: '15px' }}>
                  <label className="lp-label">Şifre Tekrar</label>
                  <div className="lp-field">
                    <IonIcon className="lp-lead-icon" icon={lockClosedOutline} />
                    <IonInput
                      className="lp-input"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      placeholder="Şifreni tekrar gir"
                      onIonInput={(e) => setConfirmPassword(e.detail.value!)}
                    />
                    <button
                      type="button"
                      className="lp-eye"
                      aria-label={showConfirm ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      onClick={() => setShowConfirm((v) => !v)}
                    >
                      <IonIcon icon={showConfirm ? eyeOffOutline : eyeOutline} />
                    </button>
                  </div>
                </div>
              )}

              {/* Kullanım koşulları — sadece kayıt modunda */}
              {!isLoginMode && (
                <div
                  className="lp-terms"
                  onClick={() => setAcceptTerms((v) => !v)}
                  role="checkbox"
                  aria-checked={acceptTerms}
                >
                  <span className={`lp-check ${acceptTerms ? 'is-checked' : ''}`}>
                    {acceptTerms && <IonIcon icon={checkmark} />}
                  </span>
                  <span className="lp-terms-text">
                    <b>Kullanım koşullarını</b> ve <b>gizlilik politikasını</b> kabul ediyorum.
                  </span>
                </div>
              )}

              {/* Ana buton */}
              <button className="lp-primary" type="submit">
                {actionLabel}
                <IonIcon className="lp-arrow" icon={arrowForward} />
              </button>

              {/* Ayıraç */}
              <div className="lp-divider">veya</div>

              {/* Sosyal (görsel — OAuth henüz yok) */}
              <button
                className="lp-social"
                type="button"
                onClick={() => socialSoon('Google')}
              >
                <IonIcon className="lp-google" icon={logoGoogle} />
                Google ile {isLoginMode ? 'giriş yap' : 'kayıt ol'}
              </button>
              <button
                className="lp-social"
                type="button"
                onClick={() => socialSoon('Apple')}
              >
                <IonIcon className="lp-apple" icon={logoApple} />
                Apple ile {isLoginMode ? 'giriş yap' : 'kayıt ol'}
              </button>
            </form>
          </div>

          {/* Mod geçişi */}
          <div className="lp-switch">
            {isLoginMode ? 'Hesabın yok mu?' : 'Zaten hesabın var mı?'}
            <button type="button" onClick={switchMode}>
              {isLoginMode ? 'Kayıt Ol' : 'Giriş Yap'}
            </button>
          </div>
        </div>

        <IonLoading isOpen={isLoading} message={'Lütfen bekleyin...'} />

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
          buttons={[{ text: 'Kapat', role: 'cancel' }]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
