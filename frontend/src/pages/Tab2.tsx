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
} from '@ionic/react';
import { send, sparklesOutline } from 'ionicons/icons';
import api from '../services/api';
import parrotAvatar from '../assets/forge-avatar.png';
import forgeHappy from '../assets/forge-happy.png';
import './Tab2.css';

interface Message {
  id: string;
  sender: 'user' | 'forge';
  text: string;
  timestamp: Date;
}

interface ChatHistoryItem {
  id: string;
  sender: 'human' | 'ai';
  message: string;
  created_at?: string;
}

const QUICK_PROMPTS = [
  'Bugünkü planımı oluştur',
  'Odaklanmama yardım et',
  'Görevimi küçük adımlara böl',
];

const renderInlineMarkdown = (text: string, keyPrefix: string) =>
  text
    .split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
        return <strong key={`${keyPrefix}-strong-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={`${keyPrefix}-em-${index}`}>{part.slice(1, -1)}</em>;
      }
      return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
    });

const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return (
    <div className="chat-message-content">
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return <span className="chat-line-break" key={`space-${index}`} />;

        const heading = line.match(/^#{1,6}\s+(.+)$/);
        if (heading) {
          return <p className="chat-message-heading" key={`heading-${index}`}>{renderInlineMarkdown(heading[1], `heading-${index}`)}</p>;
        }

        const bullet = line.match(/^[-*•]\s+(.+)$/);
        if (bullet) {
          return <div className="chat-message-list-item" key={`bullet-${index}`}><span>✓</span><p>{renderInlineMarkdown(bullet[1], `bullet-${index}`)}</p></div>;
        }

        const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
        if (numbered) {
          return <div className="chat-message-list-item is-numbered" key={`number-${index}`}><span>{numbered[1]}</span><p>{renderInlineMarkdown(numbered[2], `number-${index}`)}</p></div>;
        }

        return <p className="chat-message-paragraph" key={`line-${index}`}>{renderInlineMarkdown(line, `line-${index}`)}</p>;
      })}
    </div>
  );
};

// İlk açılışta gösterilecek karşılama mesajı (geçmiş boşsa)
const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  sender: 'forge',
  text: 'Merhaba! Ben verimlilik koçun Forge. Bugün odaklanmana nasıl yardımcı olabilirim? Hedeflerin hakkında konuşabiliriz ya da ertelediğin işleri nasıl bölebileceğimizi planlayabiliriz.',
  timestamp: new Date(),
};

type ForgeAvatarState = 'static' | 'idle' | 'talking' | 'celebrating';

// Forge'un (AI) mesajlarının yanındaki küçük cam çerçeveli papağan avatarı.
const ForgeAvatar: React.FC<{ state?: ForgeAvatarState }> = ({ state = 'idle' }) => (
  <img
    src={parrotAvatar}
    alt="Forge"
    className={`chat-avatar chat-avatar--${state}`}
  />
);

const Tab2: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [inputVal, setInputVal] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [celebratingMessageId, setCelebratingMessageId] = useState<string | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sayfa yüklendiğinde geçmiş sohbet mesajlarını backend'den çek.
  // ÖNEMLİ: Aşağıdaki loadHistory mesajları EKLEMEZ, komple DEĞİŞTİRİR.
  // (Eskiden burada "prev + history" ile ekleyen bir kopya vardı; effect'in
  // iki kez çalışması durumunda mesajları çiftliyordu. Kaldırıldı.)
  useEffect(() => {
    loadHistory();
  }, []);

  // Yeni mesaj eklendiğinde en alta kaydır
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

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
      const history: Message[] = (res.data || []).map((m: ChatHistoryItem) => ({
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
    } catch {
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
    setCelebratingMessageId(null);
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current);
    }
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
      setCelebratingMessageId(forgeResponse.id);
      celebrationTimerRef.current = setTimeout(() => {
        setCelebratingMessageId(null);
      }, 900);
    } catch (err: unknown) {
      const response = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { status?: number; data?: { detail?: string } } }).response
        : undefined;
      const errorText =
        response?.status === 401
          ? 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.'
          : response?.data?.detail || 'AI koçuna ulaşılamadı. Lütfen tekrar deneyin.';

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

  const latestForgeMessageId = [...messages]
    .reverse()
    .find((message) => message.sender === 'forge')?.id;

  return (
    <IonPage className="ff-page chat-page">
      <IonHeader>
        <IonToolbar>
          <IonTitle>AI Koç</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent ref={contentRef}>
        <div className="chat-shell">
          <section className="chat-hero ff-rise">
            <span className="chat-hero-eyebrow"><IonIcon icon={sparklesOutline} /> AI KOÇUN</span>
            <h1>Forge yanında</h1>
            <p>Takıldığın yeri anlat; birlikte sade, uygulanabilir bir yol bulalım.</p>
            <div className="chat-online"><span /> Çevrimiçi</div>
            <img src={forgeHappy} alt="Mutlu Forge maskotu" />
          </section>

          <div className="chat-day-label"><span>Bugün</span></div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-msg ff-rise ${msg.sender === 'user' ? 'is-user' : ''}`}
            >
              {/* Papağan avatarı sadece AI (Forge) mesajlarında */}
              {msg.sender === 'forge' && (
                <ForgeAvatar
                  state={
                    msg.id === celebratingMessageId
                      ? 'celebrating'
                      : msg.id === latestForgeMessageId
                        ? 'idle'
                        : 'static'
                  }
                />
              )}

              <div className={`chat-bubble ${msg.sender === 'user' ? 'is-user' : 'is-forge'}`}>
                {msg.sender === 'forge' && <span className="chat-author">Forge</span>}
                <MessageContent text={msg.text} />
                <span className="chat-time">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="chat-msg">
              <ForgeAvatar state="talking" />
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
          <div className="chat-quick-prompts" aria-label="Hızlı mesaj önerileri">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => setInputVal(prompt)} disabled={isSending}>
                {prompt}
              </button>
            ))}
          </div>
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
    </IonPage>
  );
};

export default Tab2;
