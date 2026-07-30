import React, { useEffect, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonLoading,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { homeOutline, checkboxOutline, chatbubblesOutline, personOutline, timerOutline } from 'ionicons/icons';
import Home from './pages/Home';
import Tab1 from './pages/Tab1';
import Tab2 from './pages/Tab2';
import Tab3 from './pages/Tab3';
import Focus from './pages/Focus';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import forgeNeutral from './assets/forge-neutral.png';
import forgeHappy from './assets/forge-happy.png';
import { AUTH_LOGOUT_EVENT, clearToken, getToken } from './services/api';
import { getMe } from './services/authService';
import type { User } from './services/types';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * Sınıf tabanlı palet (.ion-palette-dark). Medya sorgusu tabanlı
 * dark.system.css'i kullanmıyoruz çünkü kullanıcının Profil'den yaptığı
 * seçim medya sorgusunu ezemez. Sınıfı theme/theme.ts yazar; 'system'
 * modunda cihaz tercihini takip eder.
 * https://ionicframework.com/docs/theming/dark-mode
 */
import '@ionic/react/css/palettes/dark.class.css';

/* Theme variables */
import './theme/variables.css';

/* Tasarım sistemi (Aurora): cam yüzeyler, gradyanlar, .ff-* sınıfları.
   variables.css'ten SONRA yüklenmeli — onun token'larını kullanıyor. */
import './theme/design-system.css';

import { initTheme } from './theme/theme';

setupIonicReact({ mode: 'ios' });

// Kayıtlı tema tercihini uygula ve cihaz temasını dinlemeye başla.
initTheme();

/**
 * Sabit gradyan arka plan. Cam (glassmorphism) yüzeylerin bulanıklaştıracağı
 * renk kaynağı budur; her ekranın arkasında durur.
 */
const Aurora: React.FC = () => <div className="ff-aurora" aria-hidden="true" />;

/**
 * Oturum durumu:
 *  - 'checking' : elimizde token var, backend'e geçerli mi diye soruyoruz
 *  - 'in'       : token doğrulandı, uygulama açılabilir
 *  - 'out'      : token yok veya geçersiz, Login ekranı gösterilir
 */
type AuthStatus = 'checking' | 'in' | 'out';

const App: React.FC = () => {
  // Token varsa hemen "giriş yapıldı" saymıyoruz; süresi dolmuş olabilir.
  // Önce doğrulama (checking) aşamasına giriyoruz.
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    () => (getToken() ? 'checking' : 'out')
  );

  // Onboarding tamamlandı mı? /auth/me yanıtından okunur.
  // Tamamlanmamışsa uygulama yerine Onboarding ekranı gösterilir.
  const [onboardingDone, setOnboardingDone] = useState(false);

  // Guard: uygulama açılırken token'ı backend'e doğrulat ve onboarding
  // durumunu öğren.
  useEffect(() => {
    if (authStatus !== 'checking') return;

    let cancelled = false;
    getMe()
      .then((user: User) => {
        if (!cancelled) {
          setOnboardingDone(user.onboarding_completed);
          setAuthStatus('in');
        }
      })
      .catch(() => {
        // Geçersiz/süresi dolmuş token: temizle ve Login'e dön.
        if (!cancelled) {
          clearToken();
          setAuthStatus('out');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  // Uygulama çalışırken oturum düşerse (api.ts 401 yakalar) Login'e dön.
  useEffect(() => {
    const handleUnauthorized = () => setAuthStatus('out');
    window.addEventListener(AUTH_LOGOUT_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleUnauthorized);
  }, []);

  // Login başarılı olunca Login.tsx bu fonksiyonu çağırır.
  // 'checking'e dönerek guard'ı yeniden çalıştırıyoruz; böylece onboarding
  // durumu da /auth/me'den taze okunur (yeni kayıtlar onboarding'e düşer).
  const handleLoginSuccess = () => {
    setAuthStatus('checking');
  };

  // Onboarding tamamlanınca Onboarding.tsx bu fonksiyonu çağırır.
  const handleOnboardingComplete = () => {
    setOnboardingDone(true);
  };

  // Tab3'teki "Çıkış Yap" butonu bu fonksiyonu çağırır.
  const handleLogout = () => {
    clearToken(); // geçiş kartını sil
    setAuthStatus('out'); // tekrar Login ekranına dön
  };

  // Token doğrulanana kadar ne Login ne de uygulama gösterilir (ekran zıplamasın).
  if (authStatus === 'checking') {
    return (
      <IonApp>
        <IonLoading isOpen message={'Oturum kontrol ediliyor...'} />
      </IonApp>
    );
  }

  // Giriş yapılmamışsa: sadece Login ekranını göster.
  if (authStatus === 'out') {
    return (
      <IonApp>
        <Aurora />
        <Login onLoginSuccess={handleLoginSuccess} />
      </IonApp>
    );
  }

  // Giriş yapıldı ama onboarding tamamlanmadıysa: önce profil oluşturma akışı.
  if (!onboardingDone) {
    return (
      <IonApp>
        <Aurora />
        <Onboarding onComplete={handleOnboardingComplete} />
      </IonApp>
    );
  }

  // Giriş yapılmışsa: sekmeli uygulamayı göster.
  return (
    <IonApp>
      <Aurora />
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/home">
              <Home />
            </Route>
            <Route exact path="/tab1">
              <Tab1 />
            </Route>
            <Route exact path="/focus">
              <Focus />
            </Route>
            <Route exact path="/analytics">
              <Analytics />
            </Route>
            <Route exact path="/tab2">
              <Tab2 />
            </Route>
            <Route path="/tab3">
              <Tab3 onLogout={handleLogout} />
            </Route>
            <Route exact path="/">
              <Redirect to="/home" />
            </Route>
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="home" href="/home">
              <IonIcon aria-hidden="true" icon={homeOutline} />
              <IonLabel>Ana Sayfa</IonLabel>
            </IonTabButton>
            <IonTabButton tab="tab1" href="/tab1">
              <IonIcon aria-hidden="true" icon={checkboxOutline} />
              <IonLabel>Görevler</IonLabel>
            </IonTabButton>
            <IonTabButton tab="focus" href="/focus">
              <IonIcon aria-hidden="true" icon={timerOutline} />
              <IonLabel>Odaklan</IonLabel>
            </IonTabButton>
            <IonTabButton tab="tab2" href="/tab2" className="forge-tab-button">
              <IonIcon
                aria-hidden="true"
                icon={chatbubblesOutline}
                className="forge-tab-layout-icon"
              />
              <span className="forge-tab-mascot" aria-hidden="true">
                <img
                  src={forgeNeutral}
                  alt=""
                  className="forge-tab-image forge-tab-image--neutral"
                />
                <img
                  src={forgeHappy}
                  alt=""
                  className="forge-tab-image forge-tab-image--happy"
                />
              </span>
              <IonLabel>AI Koç</IonLabel>
            </IonTabButton>
            <IonTabButton tab="tab3" href="/tab3">
              <IonIcon aria-hidden="true" icon={personOutline} />
              <IonLabel>Profil</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;

