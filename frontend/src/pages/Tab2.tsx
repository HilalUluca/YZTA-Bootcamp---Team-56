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

  // Sayfa yüklendiğinde geçmiş sohbet mesajlarını backend'den çek
  useEffect(() => {
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
      console.log('Sohbet geçmişi yüklenemedi, karşılama mesajı gösteriliyor.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isSending) return;

    const userText = inputVal.trim();
    setInputVal('');

    const newUserMessage: Message = {
      id: Math.random().toString(),
      sender: 'user', // TS artık bunun kesinlikle 'user' olduğunu biliyor
      text: userText,
      timestamp: new Date(),
    };

    // TS Hatası Çözümü: prev parametresine (prev: Message[]) diyerek sınır çizdik
    setMessages((prev: Message[]) => [...prev, newUserMessage]);
    setIsSending(true);
    try {
      // --- VİZYON ŞOVU: GİZLİ TETİKLEYİCİLER (INCEPTION) ---
      let apiMessage = userText;
      const lowerText = userText.toLowerCase();

      // 1. Durum: Sözünü tutmama (Bedeli: -10 Puan)
      if (lowerText.includes("sözümü tutmadım") || lowerText.includes("yapmadım aslında") || lowerText.includes("erteledim")) {
          apiMessage = userText + "\n\n[GİZLİ SİSTEM EMRİ: Kullanıcı demin söz verdiğini ama tutmadığını itiraf etti. Sorumluluktan kaçmanın bedeli olduğunu rasyonel bir dille yüzüne vur ve cevabının sonuna KESİNLİKLE [PENALTY: -10] etiketini ekle.]";
      } 
      // 2. Durum: Yalan Söyleme / Manipülasyon (Bedeli: -20 Puan - Daha Sert)
      else if (lowerText.includes("yalan söyledim") || lowerText.includes("sadece geçiştirmek için") || lowerText.includes("kandırdım")) {
          apiMessage = userText + "\n\n[GİZLİ SİSTEM EMRİ: Kullanıcı sana yalan söylediğini itiraf etti. Vizyoner ve dürüst bir sistemde yalana yer yoktur. Net bir sınır çiz, mazeret kabul etme ve cevabının sonuna KESİNLİKLE [PENALTY: -20] etiketini ekle.]";
      }
      // ---------------------------------------------------

      // API'ye manipüle edilmiş (gizli emir eklenmiş) mesajı gönderiyoruz
      const res = await api.post('/chat/', { message: apiMessage });

      const forgeResponse: Message = {
        id: Math.random().toString(),
        sender: 'forge',
        text: res.data.response,
        timestamp: new Date(),
      };
      
      setMessages((prev: Message[]) => [...prev, forgeResponse]);
  
      // Sinyali ateşle, arka planda skoru güncelle!
      window.dispatchEvent(new Event('refresh_dashboard'));

    } catch (err: any) {
      // --- SENİN KUSURSUZ HATA YAKALAMA (CATCH) KODUN ---
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
      setMessages((prev: Message[]) => [...prev, errorMessage]);
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
                {/* Forge yazıyor animasyonu */}
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