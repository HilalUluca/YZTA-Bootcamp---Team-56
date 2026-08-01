import React, { useState, useEffect } from 'react';
import {
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/react';
import { alertCircleOutline, flameOutline, trophyOutline, trendingUpOutline, trendingDownOutline } from 'ionicons/icons';
import api from '../services/api';

interface HabitLog {
  completed_at: string;
}
interface Habit {
  id: string;
  title: string;
  streak_count: number;
  logs: HabitLog[];
}
interface Stats {
  total_habits: number;
  completed_today_count: number;
  completion_rate_today: number;
  longest_streak: number;
}

// completed_at (UTC, backend today mantığıyla tutarlı) → epoch'tan bu yana gün numarası
const dayNumOf = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') / 86400000);
const TODAY_NUM = Math.floor(Date.now() / 86400000);

// Bir alışkanlığın loglarından en uzun ardışık gün serisini bul
const bestRun = (logs: HabitLog[]): number => {
  const days = [...new Set(logs.map((l) => dayNumOf(l.completed_at)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    run = prev !== null && d - prev === 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
};

const HabitStats: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [weeks, setWeeks] = useState(12); // ısı haritası genişliği

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/habits/'),
        api.get('/habits/stats'),
      ]);
      setHabits(listRes.data.habits || []);
      setStats(statsRes.data);
    } catch (err) {
      setError('İstatistikler yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', marginTop: '60px' }}>
        <IonSpinner name="crescent" color="primary" style={{ transform: 'scale(1.4)' }} />
        <p style={{ color: 'var(--ion-color-medium)' }}>İstatistikler yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--ion-color-danger)' }}>
        <IonIcon icon={alertCircleOutline} style={{ fontSize: '56px' }} />
        <h3>Bir sorun oluştu</h3>
        <p style={{ color: 'var(--ion-color-medium)' }}>{error}</p>
        <IonButton onClick={load} fill="outline" color="danger">Tekrar Dene</IonButton>
      </div>
    );
  }

  if (!habits || !stats) return null;

  if (habits.length === 0) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--ion-color-medium)' }}>
        <h3>Henüz veri yok</h3>
        <p>Alışkanlık ekleyip işaretlemeye başladığında istatistiklerin burada belirir.</p>
      </div>
    );
  }

  // Gün bazında toplam tamamlama sayısı (tüm alışkanlıklar)
  const countByDay: Record<number, number> = {};
  habits.forEach((h) => h.logs.forEach((l) => {
    const d = dayNumOf(l.completed_at);
    countByDay[d] = (countByDay[d] || 0) + 1;
  }));
  const maxPerDay = Math.max(1, ...Object.values(countByDay));

  // Isı haritası ızgarası (GitHub tarzı): haftalar sütun, haftanın günleri satır
  const todayDow = new Date(TODAY_NUM * 86400000).getUTCDay(); // 0=Pazar
  const columns: ({ dayNum: number; count: number } | null)[][] = [];
  for (let c = 0; c < weeks; c++) {
    const col: ({ dayNum: number; count: number } | null)[] = [];
    for (let r = 0; r < 7; r++) {
      const daysAgo = (todayDow - r) + (weeks - 1 - c) * 7;
      if (daysAgo < 0) {
        col.push(null); // gelecekteki günler (bu haftanın kalanı)
      } else {
        const dn = TODAY_NUM - daysAgo;
        col.push({ dayNum: dn, count: countByDay[dn] || 0 });
      }
    }
    columns.push(col);
  }

  const cellColor = (count: number) =>
    count === 0
      ? 'rgba(var(--ion-color-primary-rgb), 0.1)'
      : `rgba(var(--ion-color-primary-rgb), ${(0.35 + 0.65 * (count / maxPerDay)).toFixed(2)})`;

  // En çok / en az yapılan
  const withCounts = habits
    .map((h) => ({ title: h.title, count: h.logs.length }))
    .sort((a, b) => b.count - a.count);
  const mostDone = withCounts[0];
  const leastDone = withCounts[withCounts.length - 1];

  // Seriler
  const activeStreak = stats.longest_streak; // backend: mevcut en uzun aktif seri
  const bestStreak = Math.max(0, ...habits.map((h) => bestRun(h.logs))); // client-side: tüm zamanların en iyisi

  const statCard = (label: string, value: React.ReactNode, color: string, icon: string) => (
    <div style={{
      flex: 1,
      background: 'var(--ion-card-background, var(--ion-background-color))',
      border: '1px solid rgba(var(--ion-text-color-rgb,0,0,0),0.08)',
      borderRadius: '14px',
      padding: '12px',
      textAlign: 'center',
    }}>
      <IonIcon icon={icon} style={{ fontSize: '22px', color: `var(--ion-color-${color})` }} />
      <div style={{ fontSize: '22px', fontWeight: 'bold', margin: '2px 0' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--ion-color-medium)' }}>{label}</div>
    </div>
  );

  return (
    <div>
      {/* Özet kartlar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {statCard('Bugünkü tamamlanma', `%${Math.round(stats.completion_rate_today)}`, 'tertiary', trophyOutline)}
        {statCard('Bugün', `${stats.completed_today_count}/${stats.total_habits}`, 'secondary', trendingUpOutline)}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {statCard('Aktif seri', activeStreak, 'warning', flameOutline)}
        {statCard('En iyi seri', bestStreak, 'primary', flameOutline)}
      </div>

      {/* Isı haritası */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontWeight: 'bold', fontSize: '16px', margin: 0 }}>Aktivite ısı haritası</h2>
        <IonSegment
          value={String(weeks)}
          onIonChange={(e) => setWeeks(parseInt(e.detail.value as string))}
          style={{ width: '160px' }}
        >
          <IonSegmentButton value="4"><IonLabel>4 hafta</IonLabel></IonSegmentButton>
          <IonSegmentButton value="12"><IonLabel>12 hafta</IonLabel></IonSegmentButton>
        </IonSegment>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
        <div style={{ display: 'flex', gap: '3px' }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {col.map((cell, ri) => (
                <div
                  key={ri}
                  title={cell ? `${new Date(cell.dayNum * 86400000).toLocaleDateString('tr-TR')}: ${cell.count} tamamlama` : ''}
                  style={{
                    width: '13px',
                    height: '13px',
                    borderRadius: '3px',
                    background: cell ? cellColor(cell.count) : 'transparent',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* Renk açıklaması */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <IonText color="medium" style={{ fontSize: '11px' }}>az</IonText>
        {[0, 1, 2, 3].map((n) => (
          <div key={n} style={{ width: '12px', height: '12px', borderRadius: '3px', background: cellColor((n / 3) * maxPerDay) }} />
        ))}
        <IonText color="medium" style={{ fontSize: '11px' }}>çok</IonText>
      </div>

      {/* En çok / en az yapılan */}
      <h2 style={{ fontWeight: 'bold', fontSize: '16px', margin: '24px 0 8px 0' }}>Alışkanlık özeti</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(var(--ion-text-color-rgb,0,0,0),0.08)' }}>
        <IonIcon icon={trendingUpOutline} style={{ color: 'var(--ion-color-tertiary)', fontSize: '20px' }} />
        <span style={{ flex: 1 }}>En çok yapılan</span>
        <b>{mostDone.title}</b>
        <IonText color="medium" style={{ fontSize: '13px' }}>{mostDone.count}×</IonText>
      </div>
      {withCounts.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
          <IonIcon icon={trendingDownOutline} style={{ color: 'var(--ion-color-medium)', fontSize: '20px' }} />
          <span style={{ flex: 1 }}>En az yapılan</span>
          <b>{leastDone.title}</b>
          <IonText color="medium" style={{ fontSize: '13px' }}>{leastDone.count}×</IonText>
        </div>
      )}
    </div>
  );
};

export default HabitStats;
