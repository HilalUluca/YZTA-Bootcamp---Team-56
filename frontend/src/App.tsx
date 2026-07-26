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
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import api, { AUTH_LOGOUT_EVENT, clearToken, getToken } from './services/api';

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
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

setupIonicReact();

// Token'ın (JWT) ortadaki parçasından kullanıcı kimliğini (sub) çıkar.
// Backend /auth/me onboarding durumunu vermediği için bayrağı kullanıcıya göre saklıyoruz.
const getUserId = (): string | null => {
  const t = getToken();
  if (!t) return null;
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.sub || null;
  } catch {
    return null;
  }
};

// Bu kullanıcı onboarding'i (bu cihazda) tamamlamış mı?
const onboardingDone = (): boolean => {
  const id = getUserId();
  if (!id) return true; // kimlik yoksa wizard'ı zorlamıyoruz
  return localStorage.getItem('ff_onboarding_done_' + id) === '1';
};

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
  // Onboarding gerekiyor mu? (sadece ilk girişte gösterilecek)
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(
    () => !!localStorage.getItem('token') && !onboardingDone()
  );

  // Guard: uygulama açılırken token'ı backend'e doğrulat.
  useEffect(() => {
    if (authStatus !== 'checking') return;

    let cancelled = false;
    api
      .get('/auth/me')
      .then(() => {
        if (!cancelled) setAuthStatus('in');
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
  const handleLoginSuccess = () => {
    setAuthStatus('in');
    setNeedsOnboarding(!onboardingDone());
  };

  // Tab3'teki "Çıkış Yap" butonu bu fonksiyonu çağırır.
  const handleLogout = () => {
    clearToken(); // geçiş kartını sil
    setAuthStatus('out'); // tekrar Login ekranına dön
    setNeedsOnboarding(false);
  };

  // Onboarding tamamlanınca (veya atlanınca): bayrağı set et, uygulamaya gir.
  const finishOnboarding = () => {
    const id = getUserId();
    if (id) localStorage.setItem('ff_onboarding_done_' + id, '1');
    setNeedsOnboarding(false);
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
        <Login onLoginSuccess={handleLoginSuccess} />
      </IonApp>
    );
  }

  // Giriş yapıldı ama onboarding tamamlanmadıysa: wizard'ı göster.
  if (needsOnboarding) {
    return (
      <IonApp>
        <Onboarding onComplete={finishOnboarding} />
      </IonApp>
    );
  }

  // Giriş yapılmışsa: sekmeli uygulamayı göster.
  return (
    <IonApp>
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
            <IonTabButton tab="tab2" href="/tab2">
              <IonIcon aria-hidden="true" icon={chatbubblesOutline} />
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

