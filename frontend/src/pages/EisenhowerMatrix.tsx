import React, { useState } from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import {
  alertCircleOutline,
  chevronDownOutline,
  chevronUpOutline,
  refreshOutline,
  sparklesOutline,
} from 'ionicons/icons';
import api from '../services/api';
import forgeNeutral from '../assets/forge-neutral.png';
import forgeHappy from '../assets/forge-happy.png';

interface PrioritizedTask {
  task_name: string;
  priority_score: number;
  ai_reasoning: string;
  eisenhower_category: string;
}

const QUADRANTS = [
  { key: 'urgent_important', title: 'Acil & Önemli', action: 'Hemen yap', tone: 'danger' },
  { key: 'important', title: 'Önemli', action: 'Planla', tone: 'warning' },
  { key: 'urgent', title: 'Acil', action: 'Hızlıca bitir', tone: 'cool' },
  { key: 'low', title: 'Düşük Öncelik', action: 'Sonraya bırak', tone: 'mint' },
] as const;

const EisenhowerMatrix: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<PrioritizedTask[] | null>(null);
  const [summary, setSummary] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const prioritize = async () => {
    setLoading(true);
    setError(null);
    setTasks(null);
    setSummary('');
    try {
      const res = await api.post('/tasks/prioritize', {});
      const data = res.data || {};
      setTasks(data.tasks || []);
      setSummary(data.summary || '');
    } catch (err: unknown) {
      const detail = typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
        : undefined;
      setError(typeof detail === 'string' ? detail : 'Önceliklendirme yapılamadı. Lütfen biraz sonra tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="matrix-loading">
        <img src={forgeHappy} alt="Görevleri inceleyen Forge" />
        <IonSpinner name="crescent" color="primary" />
        <h3>Forge görevlerini sıralıyor</h3>
        <p>Aciliyet ve önem dengesi analiz ediliyor.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="matrix-error">
        <IonIcon icon={alertCircleOutline} />
        <h3>Önceliklendirme yapılamadı</h3>
        <p>{error}</p>
        <button className="ff-btn ff-btn-ghost ff-btn-auto" onClick={prioritize}>Tekrar dene</button>
      </div>
    );
  }

  if (tasks === null) {
    return (
      <section className="matrix-intro ff-rise">
        <span className="matrix-eyebrow">AI DESTEKLİ ÖNCELİK</span>
        <h2>Karar vermeyi Forge'a bırak</h2>
        <p>Açık görevlerin aciliyet ve önem durumuna göre dört net alana ayrılsın.</p>
        <button className="ff-btn" type="button" onClick={prioritize}>
          <IonIcon icon={sparklesOutline} />
          Önceliklendir
        </button>
        <img src={forgeNeutral} alt="Forge maskotu" />
      </section>
    );
  }

  return (
    <div className="matrix-results ff-rise">
      {summary && <p className="matrix-summary">✨ {summary}</p>}

      <div className="matrix-grid">
        {QUADRANTS.map((quadrant) => {
          const items = tasks.filter((task) => task.eisenhower_category === quadrant.key);
          return (
            <section className={`matrix-quadrant is-${quadrant.tone}`} key={quadrant.key}>
              <header>
                <div>
                  <strong>{quadrant.title}</strong>
                  <small>{quadrant.action}</small>
                </div>
                <b>{items.length}</b>
              </header>
              <div className="matrix-items">
                {items.length === 0 ? (
                  <p className="matrix-empty">Bu alanda görev yok.</p>
                ) : items.map((task, index) => {
                  const id = `${quadrant.key}-${index}`;
                  const isExpanded = expanded === id;
                  return (
                    <article className="matrix-task" key={id} onClick={() => setExpanded(isExpanded ? null : id)}>
                      <div>
                        <strong>{task.task_name}</strong>
                        {task.ai_reasoning && <IonIcon icon={isExpanded ? chevronUpOutline : chevronDownOutline} />}
                      </div>
                      {isExpanded && task.ai_reasoning && <p>💡 {task.ai_reasoning}</p>}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <button className="ff-btn ff-btn-ghost matrix-refresh" type="button" onClick={prioritize}>
        <IonIcon icon={refreshOutline} />
        Yeniden önceliklendir
      </button>
    </div>
  );
};

export default EisenhowerMatrix;
