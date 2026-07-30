import React, { useEffect, useMemo, useState } from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  alertCircleOutline,
  barChartOutline,
  bulbOutline,
  flameOutline,
  happyOutline,
  refreshOutline,
  timeOutline,
} from 'ionicons/icons';
import api from '../services/api';
import type {
  DashboardStats,
  FocusStatsSummary,
  HabitStatsSummary,
  MoodTrendPoint,
  ReflectionAnalysis,
  WeeklyReport,
} from '../services/types';
import './Analytics.css';

type AnalysisPeriod = 7 | 30;

const MOOD_LABELS: Record<string, string> = {
  great: 'Harika',
  good: 'İyi',
  neutral: 'Nötr',
  low: 'Düşük',
  bad: 'Kötü',
};

const sentimentText = (value: ReflectionAnalysis['sentiment_summary']) => {
  if (!value) return 'Analiz yok';
  if (typeof value === 'string') return value;

  const labels: Record<string, string> = {
    positive: 'Pozitif',
    neutral: 'Nötr',
    negative: 'Negatif',
  };
  return labels[value.label] || value.label;
};

const sentimentScore = (value: ReflectionAnalysis['sentiment_summary']) => {
  if (!value || typeof value === 'string') return null;
  return value.score;
};

const formatShortDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
  });

const MoodChart: React.FC<{ points: MoodTrendPoint[] }> = ({ points }) => {
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.date.localeCompare(b.date)),
    [points],
  );

  const width = 620;
  const height = 220;
  const paddingX = 46;
  const paddingY = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const coordinates = sorted.map((point, index) => ({
    ...point,
    x:
      sorted.length === 1
        ? width / 2
        : paddingX + (index / (sorted.length - 1)) * chartWidth,
    y: paddingY + ((5 - point.value) / 4) * chartHeight,
  }));

  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  const dateIndexes = sorted.length > 2
    ? [0, Math.floor((sorted.length - 1) / 2), sorted.length - 1]
    : sorted.map((_, index) => index);

  return (
    <div className="analytics-line-chart" role="img" aria-label="Ruh hali trend grafiği">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {[5, 4, 3, 2, 1].map((value) => {
          const y = paddingY + ((5 - value) / 4) * chartHeight;
          return (
            <g key={value}>
              <line className="analytics-chart-grid" x1={paddingX} y1={y} x2={width - paddingX} y2={y} />
              <text className="analytics-chart-y-label" x={paddingX - 15} y={y + 4}>
                {value}
              </text>
            </g>
          );
        })}

        {coordinates.length > 1 && (
          <polyline className="analytics-chart-line" points={polyline} />
        )}

        {coordinates.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle className="analytics-chart-dot-ring" cx={point.x} cy={point.y} r="7" />
            <circle className="analytics-chart-dot" cx={point.x} cy={point.y} r="4" />
            <title>
              {formatShortDate(point.date)}: {MOOD_LABELS[point.label] || point.label} ({point.value}/5)
            </title>
          </g>
        ))}

        {dateIndexes.map((index) => (
          <text
            key={sorted[index].date}
            className="analytics-chart-x-label"
            x={coordinates[index].x}
            y={height - 3}
            textAnchor={index === 0 ? 'start' : index === sorted.length - 1 ? 'end' : 'middle'}
          >
            {formatShortDate(sorted[index].date)}
          </text>
        ))}
      </svg>
    </div>
  );
};

const FocusBarChart: React.FC<{ report: WeeklyReport }> = ({ report }) => {
  const maxMinutes = Math.max(...report.days.map((day) => day.focus_minutes), 1);

  return (
    <div className="analytics-bar-chart" role="img" aria-label="Son 7 gün çalışma süresi grafiği">
      {report.days.map((day) => {
        const height = day.focus_minutes > 0
          ? Math.max((day.focus_minutes / maxMinutes) * 100, 7)
          : 2;

        return (
          <div className="analytics-bar-column" key={day.date}>
            <span className="analytics-bar-value">{day.focus_minutes} dk</span>
            <div className="analytics-bar-track">
              <div
                className={`analytics-bar-fill ${day.focus_minutes === 0 ? 'is-empty' : ''}`}
                style={{ height: `${height}%` }}
              />
            </div>
            <span className="analytics-bar-label">{day.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const Analytics: React.FC = () => {
  const [period, setPeriod] = useState<AnalysisPeriod>(7);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [focus, setFocus] = useState<FocusStatsSummary | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [habits, setHabits] = useState<HabitStatsSummary | null>(null);
  const [analysis, setAnalysis] = useState<ReflectionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoodLoading, setIsMoodLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [moodError, setMoodError] = useState('');

  const loadOverview = async () => {
    setIsLoading(true);
    setOverviewError('');
    try {
      const [dashboardRes, focusRes, weeklyRes, habitsRes] = await Promise.all([
        api.get<DashboardStats>('/stats/dashboard'),
        api.get<FocusStatsSummary>('/focus/stats/summary'),
        api.get<WeeklyReport>('/stats/weekly-report'),
        api.get<HabitStatsSummary>('/habits/stats'),
      ]);
      setDashboard(dashboardRes.data);
      setFocus(focusRes.data);
      setWeekly(weeklyRes.data);
      setHabits(habitsRes.data);
    } catch {
      setOverviewError('İstatistikler yüklenemedi. Bağlantını kontrol edip tekrar dene.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoodAnalysis = async (days: AnalysisPeriod) => {
    setIsMoodLoading(true);
    setMoodError('');
    try {
      const res = await api.post<ReflectionAnalysis>('/reflections/analyze', null, {
        params: { days },
      });
      setAnalysis(res.data);
    } catch (error: unknown) {
      const status =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof error.response === 'object' &&
        error.response !== null &&
        'status' in error.response
          ? error.response.status
          : null;

      setAnalysis(null);
      setMoodError(
        status === 404
          ? `Son ${days} günde analiz edilecek yansıma bulunamadı.`
          : 'Ruh hali analizi şu anda yüklenemedi.',
      );
    } finally {
      setIsMoodLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    loadMoodAnalysis(period);
  }, [period]);

  const habitRate = Math.min(Math.max(habits?.completion_rate_today || 0, 0), 100);
  const score = sentimentScore(analysis?.sentiment_summary ?? null);

  return (
    <IonPage className="analytics-page ff-page">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" text="" />
          </IonButtons>
          <IonTitle>Detaylı İstatistikler</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="analytics-shell">
          <section className="analytics-heading ff-rise">
            <div>
              <p className="ff-subtitle">Performans özeti</p>
              <h1 className="ff-title">Gelişimini keşfet</h1>
            </div>
            <button
              className="analytics-refresh"
              type="button"
              onClick={() => {
                loadOverview();
                loadMoodAnalysis(period);
              }}
              aria-label="İstatistikleri yenile"
            >
              <IonIcon icon={refreshOutline} />
            </button>
          </section>

          {isLoading && !dashboard ? (
            <div className="analytics-state">
              <IonSpinner name="crescent" color="primary" />
              <p>İstatistiklerin hazırlanıyor...</p>
            </div>
          ) : overviewError && !dashboard ? (
            <div className="analytics-state">
              <IonIcon icon={alertCircleOutline} />
              <h2>Bir sorun oluştu</h2>
              <p>{overviewError}</p>
              <button className="ff-btn ff-btn-auto" type="button" onClick={loadOverview}>
                Tekrar Dene
              </button>
            </div>
          ) : (
            <>
              <section className="analytics-summary-grid ff-rise">
                <article className="analytics-summary-card">
                  <span className="analytics-summary-icon is-primary">
                    <IonIcon icon={timeOutline} />
                  </span>
                  <strong>{focus?.total_focus_hours ?? dashboard?.focus.total_hours ?? 0} sa</strong>
                  <span>Toplam odak</span>
                </article>
                <article className="analytics-summary-card">
                  <span className="analytics-summary-icon is-cool">
                    <IonIcon icon={barChartOutline} />
                  </span>
                  <strong>{focus?.total_sessions ?? 0}</strong>
                  <span>Odak seansı</span>
                </article>
                <article className="analytics-summary-card">
                  <span className="analytics-summary-icon is-gold">
                    <IonIcon icon={flameOutline} />
                  </span>
                  <strong>{habits?.longest_streak ?? dashboard?.user.streak_count ?? 0}</strong>
                  <span>En uzun seri</span>
                </article>
              </section>

              <section className="analytics-card ff-card ff-rise">
                <div className="analytics-card-heading">
                  <div>
                    <span className="analytics-eyebrow">Ruh hali</span>
                    <h2>Mood trendi</h2>
                  </div>
                  <div className="analytics-period" aria-label="Analiz dönemi">
                    {([7, 30] as AnalysisPeriod[]).map((days) => (
                      <button
                        key={days}
                        type="button"
                        className={period === days ? 'is-active' : ''}
                        onClick={() => setPeriod(days)}
                      >
                        {days} gün
                      </button>
                    ))}
                  </div>
                </div>

                {isMoodLoading ? (
                  <div className="analytics-inline-state">
                    <IonSpinner name="dots" color="primary" />
                    <span>Forge yansımalarını analiz ediyor...</span>
                  </div>
                ) : analysis && analysis.mood_trend.data.length > 0 ? (
                  <>
                    <div className="analytics-mood-meta">
                      <div>
                        <strong>{analysis.mood_trend.average.toFixed(1)}</strong>
                        <span>/ 5 ortalama</span>
                      </div>
                      <span className="analytics-trend-pill">
                        Trend: {analysis.mood_trend.direction}
                      </span>
                    </div>
                    <MoodChart points={analysis.mood_trend.data} />
                  </>
                ) : (
                  <div className="analytics-inline-state is-empty">
                    <IonIcon icon={happyOutline} />
                    <span>{moodError}</span>
                  </div>
                )}
              </section>

              {weekly && (
                <section className="analytics-card ff-card ff-rise">
                  <div className="analytics-card-heading">
                    <div>
                      <span className="analytics-eyebrow">Odaklanma</span>
                      <h2>Çalışma süresi</h2>
                    </div>
                    <strong className="analytics-card-total">
                      {weekly.totals.focus_minutes} dk
                    </strong>
                  </div>
                  <FocusBarChart report={weekly} />
                </section>
              )}

              <section className="analytics-two-column">
                <article className="analytics-card analytics-habit-card ff-card ff-rise">
                  <div>
                    <span className="analytics-eyebrow">Alışkanlıklar</span>
                    <h2>Bugünkü oran</h2>
                    <p>
                      {habits?.completed_today_count ?? 0} / {habits?.total_habits ?? 0} alışkanlık tamamlandı
                    </p>
                  </div>
                  <div
                    className="analytics-habit-ring"
                    style={{ '--habit-rate': `${habitRate * 3.6}deg` } as React.CSSProperties}
                    aria-label={`Alışkanlık tamamlama oranı yüzde ${Math.round(habitRate)}`}
                  >
                    <span>%{Math.round(habitRate)}</span>
                  </div>
                </article>

                <article className="analytics-card analytics-ai-card ff-card ff-rise">
                  <span className="analytics-summary-icon is-primary">
                    <IonIcon icon={bulbOutline} />
                  </span>
                  <div>
                    <span className="analytics-eyebrow">Forge yorumu</span>
                    <h2>{sentimentText(analysis?.sentiment_summary ?? null)}</h2>
                    {score !== null && (
                      <p className="analytics-sentiment-score">
                        Duygu skoru: {score.toFixed(2)}
                      </p>
                    )}
                    <p>
                      {analysis?.recommendation ||
                        'Daha kişisel bir yorum için günlük yansımalarını doldurmaya devam et.'}
                    </p>
                  </div>
                </article>
              </section>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Analytics;
