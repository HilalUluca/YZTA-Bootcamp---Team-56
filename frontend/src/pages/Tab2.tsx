import React, { useState, useRef, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonFooter,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonList,
  IonText,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { send } from 'ionicons/icons';
import api from '../services/api';
import './Tab2.css';

interface Message {
  id: string;
  sender: 'user' | 'forge';
  text: string;
  timestamp: Date;
}

// İlk açılışta gösterilecek karşılama mesajı (geçmiş boşsa)
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  sender: 'forge',
  text: 'Merhaba! Ben verimlilik koçun Forge. Bugün odaklanmana nasıl yardımcı olabilirim? Hedeflerin hakkında konuşabiliriz ya da ertelediğin işleri nasıl bölebileceğimizi planlayabiliriz.',
  timestamp: new Date(),
};

const Tab2: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);

  // Sayfa yüklendiğinde geçmiş sohbet mesajlarını backend'den çek
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await api.get('/chat/history', { params: { limit: 50 } });
        if (res.data && res.data.length > 0) {
          const historyMessages: Message[] = res.data.map((msg: any) => ({
            id: msg.id,
            sender: msg.sender === 'human' ? 'user' : 'forge',
            text: msg.message,
            timestamp: new Date(msg.created_at),
          }));
          setMessages((prev) => [...prev, ...historyMessages]);
        }
      } catch (err: any) {
        console.log('Sohbet geçmişi yüklenemedi:', err.message);
      }
    };
    loadHistory();
  }, []);

  // Yeni mesaj eklendiğinde en alta kaydır
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (contentRef.current) {
      contentRef.current.scrollToBottom(300);
    }
  };

  // Geçmiş sohbeti yükle: GET /api/chat/history
  const loadHistory = async () => {
    try {
      const res = await api.get('/chat/history', { params: { limit: 50 } });
      // Backend sender'ı "human"/"ai" döndürür; arayüzde "user"/"forge"e çeviriyoruz.
      const history: Message[] = (res.data || []).map((m: any) => ({
        id: m.id,
        sender: m.sender === 'human' ? 'user' : 'forge',
        text: m.message,
        timestamp: m.created_at ? new Date(m.created_at) : new Date(),
      }));
      // Geçmiş varsa onu göster; yoksa karşılama mesajı kalır.
      if (history.length > 0) {
        setMessages(history);
      }
    } catch (err) {
      // Geçmiş yüklenemezse sessizce karşılama mesajıyla devam et.
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isSending) return;

    const userText = inputVal.trim();
    setInputVal('');

    const newUserMessage: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsSending(true);

    try {
      // Backend'deki POST /api/chat/ endpoint'ine gerçek istek at
      const res = await api.post('/chat/', { message: userText });

      const forgeResponse: Message = {
        id: Math.random().toString(),
        sender: 'forge',
        text: res.data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, forgeResponse]);
    } catch (err: any) {
      const errorText =
        err.response?.status === 401
          ? 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.'
          : err.response?.data?.detail || 'AI koçuna ulaşılamadı. Lütfen tekrar deneyin.';

      const errorMessage: Message = {
        id: Math.random().toString(),
        sender: 'forge',
        text: `⚠️ ${errorText}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>AI Koç (Forge)</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" ref={contentRef}>
        <IonList style={{ background: 'transparent' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                  background: msg.sender === 'user' ? 'var(--ion-color-primary)' : 'var(--ion-color-light, #2b2b2b)',
                  color: msg.sender === 'user' ? '#fff' : 'var(--ion-text-color, #fff)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              >
                <IonText style={{ fontSize: '15px', lineHeight: '1.4' }}>
                  {msg.text}
                </IonText>
                <div
                  style={{
                    textAlign: 'right',
                    fontSize: '10px',
                    opacity: 0.6,
                    marginTop: '4px',
                  }}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isSending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 2px',
                  background: 'var(--ion-color-light, #2b2b2b)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <IonSpinner name="dots" color="primary" />
                <IonText style={{ fontSize: '13px', color: 'var(--ion-color-medium)' }}>
                  Forge düşünüyor...
                </IonText>
              </div>
            </div>
          )}
        </IonList>
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', padding: '4px' }}>
            <IonItem style={{ flex: 1, '--background': 'transparent' }}>
              <IonInput
                value={inputVal}
                placeholder="Forge'a bir mesaj yazın..."
                onIonInput={(e) => setInputVal(e.detail.value!)}
                disabled={isSending}
                style={{
                  '--padding-start': '8px',
                  '--color': 'var(--ion-text-color)',
                  '--placeholder-color': 'var(--ion-color-medium)',
                }}
              />
            </IonItem>
            <IonButton
              fill="clear"
              type="submit"
              disabled={!inputVal.trim() || isSending}
              style={{ margin: 0 }}
            >
              <IonIcon slot="icon-only" icon={send} color="primary" />
            </IonButton>
          </form>
        </IonToolbar>
      </IonFooter>

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMessage}
        duration={3000}
        color="danger"
      />
    </IonPage>
  );
};

export default Tab2;

