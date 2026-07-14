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

    // Mock yanıt listesi
    const mockReplies = [
      "Harika bir noktaya değindin! Görevlerini tamamlamak için 25 dakikalık bir Pomodoro seansı başlatmamı ister misin?",
      "Erteleme davranışının önüne geçmek için bu görevi 15'er dakikalık 3 küçük parçaya bölmeyi deneyelim.",
      "Bu hedef gerçekten çok önemli. Odaklanmanı artırmak için telefonunu başka bir odaya bırakmanı öneririm.",
      "Çok iyi gidiyorsun! Motivasyonunu yüksek tutmak için küçük adımlarla ilerlemeye devam et.",
      "Stres seviyeni azaltmak için 2 dakikalık bir nefes egzersizi yapmak ister misin?"
    ];

    const randomReply = mockReplies[Math.floor(Math.random() * mockReplies.length)];

    setTimeout(() => {
      const forgeResponse: Message = {
        id: Math.random().toString(),
        sender: 'forge',
        text: randomReply,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, forgeResponse]);
      setIsSending(false);
    }, 1200);
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

