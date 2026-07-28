import React, { useState, useRef, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonFooter,
  IonInput,
  IonIcon,
  IonToast,
} from '@ionic/react';
import { send } from 'ionicons/icons';
import api from '../services/api';
import parrotAvatar from '../assets/parrot-login.png';
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

// Forge'un (AI) mesajlarının yanındaki küçük cam çerçeveli papağan avatarı.
const ForgeAvatar: React.FC = () => (
  <img src={parrotAvatar} alt="Forge" className="chat-avatar" />
);

const Tab2: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const contentRef = useRef<HTMLIonContentElement>(null);

  // Sayfa yüklendiğinde geçmiş sohbet mesajlarını backend'den çek.
  // ÖNEMLİ: Aşağıdaki loadHistory mesajları EKLEMEZ, komple DEĞİŞTİRİR.
  // (Eskiden burada "prev + history" ile ekleyen bir kopya vardı; effect'in
  // iki kez çalışması durumunda mesajları çiftliyordu. Kaldırıldı.)
  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Aynı id'li mesaj birden fazla gelirse tekilleştir (tekrar önlemi)
        const seen = new Set<string>();
        const unique = history.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        // Kronolojik sırala: önce created_at'e göre ARTAN (en eski üstte).
        // Aynı ana denk gelen (soru+cevap tek istekte kaydedildiği için created_at
        // eşit olabilir) mesajlarda kullanıcı sorusu AI cevabından önce gelsin.
        unique.sort((a, b) => {
          const diff = a.timestamp.getTime() - b.timestamp.getTime();
          if (diff !== 0) return diff;
          if (a.sender === b.sender) return 0;
          return a.sender === 'user' ? -1 : 1; // user (soru) önce, forge (cevap) sonra
        });
        setMessages(unique);
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
    <IonPage className="ff-page chat-page">
      <IonHeader>
        <IonToolbar>
          <IonTitle>AI Koç</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef}>
        <div style={{ padding: '10px 16px 4px' }}>
          {/* Başlık */}
          <div className="ff-rise" style={{ marginBottom: '18px' }}>
            <h1 className="ff-title">Forge</h1>
            <p className="ff-subtitle">Verimlilik koçun — takıldığın yeri anlat, birlikte çözelim.</p>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-msg ff-rise ${msg.sender === 'user' ? 'is-user' : ''}`}
            >
              {/* Papağan avatarı sadece AI (Forge) mesajlarında */}
              {msg.sender === 'forge' && <ForgeAvatar />}

              <div className={`chat-bubble ${msg.sender === 'user' ? 'is-user' : 'is-forge'}`}>
                {msg.text}
                <span className="chat-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="chat-msg">
              <ForgeAvatar />
              <div className="chat-bubble is-forge">
                {/* Forge yazıyor: üç nokta sırayla zıplar (stil Tab2.css'te) */}
                <div className="forge-typing" role="status" aria-label="Forge yazıyor">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter className="chat-footer">
        <IonToolbar>
          <form onSubmit={handleSendMessage} className="chat-composer">
            <IonInput
              className="chat-input"
              value={inputVal}
              placeholder="Forge'a bir mesaj yaz..."
              onIonInput={(e) => setInputVal(e.detail.value!)}
              disabled={isSending}
            />
            <button
              className="chat-send"
              type="submit"
              disabled={!inputVal.trim() || isSending}
              aria-label="Gönder"
            >
              <IonIcon icon={send} />
            </button>
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
