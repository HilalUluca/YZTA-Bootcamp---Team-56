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
} from '@ionic/react';
import { send } from 'ionicons/icons';
import './Tab2.css';

interface Message {
  id: string;
  sender: 'user' | 'forge';
  text: string;
  timestamp: Date;
}

const Tab2: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      sender: 'forge',
      text: 'Merhaba! Ben verimlilik koçun Forge. Bugün odaklanmana nasıl yardımcı olabilirim? Hedeflerin hakkında konuşabiliriz ya da ertelediğin işleri nasıl bölebileceğimizi planlayabiliriz.',
      timestamp: new Date(),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);

  // Yeni mesaj eklendiğinde en alta kaydır
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (contentRef.current) {
      contentRef.current.scrollToBottom(300);
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
      // MİMARİ MÜHÜR: Gerçek Backend (FastAPI) Bağlantısı
      const response = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Not: app/schemas/chat.py içindeki Pydantic modeline göre buradaki 'message' anahtarını
        // 'text' veya 'content' olarak değiştirmen gerekebilir.
        body: JSON.stringify({ message: userText }), 
      });

      if (!response.ok) {
        throw new Error(`HTTP hatası! Durum: ${response.status}`);
      }

      const data = await response.json();
      
      // Backend'den dönen JSON'un yapısına göre doğru değeri çekiyoruz (defensive approach)
      const forgeText = data.response || data.text || data.message || data.reply || "Forge'dan veri alınamadı.";

      const forgeResponse: Message = {
        id: Math.random().toString(),
        sender: 'forge',
        text: forgeText,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, forgeResponse]);
      
    } catch (error) {
      console.error("API Entegrasyon Hatası:", error);
      
      // Hata Yönetimi: Sistemin çökmesi durumunda kullanıcıyı bilgilendir
      const errorResponse: Message = {
        id: Math.random().toString(),
        sender: 'forge',
        text: "Sistem hatası: Backend'e ulaşılamıyor. Lütfen uvicorn terminalini kontrol et.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
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
                  Forge analiz ediyor...
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
                placeholder="Forge'a bir strateji veya sorun yazın..."
                onIonInput={(e) => setInputVal(e.detail.value!)}
                disabled={isSending}
                style={{ '--padding-start': '8px' }}
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
    </IonPage>
  );
};

export default Tab2;