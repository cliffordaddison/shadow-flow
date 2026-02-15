/**
 * Daily goals: circular progress, today's focus recommendation, motivational messages.
 */

import { useStore } from '@/store/useStore';
import { getDueSentences, getMasteredSpeakingCount } from '@/store/sentences';
import { getDailyRoutine, getDailyStreak } from '@/engine/dailyRoutine';

export function DailyGoals() {
  const { setLearningView } = useStore();
  const due = getDueSentences();
  const mastered = getMasteredSpeakingCount();
  const routine = getDailyRoutine();
  const streak = getDailyStreak();
  const primarySession = routine[0];
  const reviewDone = primarySession ? Math.min(primarySession.reviewCount, due.length) : 0;
  const reviewTarget = primarySession?.reviewCount ?? 20;
  const pct = reviewTarget > 0 ? Math.min(100, (reviewDone / reviewTarget) * 100) : 0;

  let focusMessage = 'Focus on speaking practice today.';
  if (due.length >= 20 && mastered >= 50) focusMessage = 'Focus on drill mode today.';
  else if (mastered >= 1) focusMessage = 'Focus on writing practice today.';
  if (due.length < 5) focusMessage = 'Add new sentences or do Phase 1 exposure.';

  return (
    <section
      style={{
        background: 'var(--sf-bg-card)',
        border: '1px solid var(--sf-border)',
        borderRadius: 16,
        padding: 24,
      }}
    >
      <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>Daily Goals</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <svg style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }} viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="var(--sf-bg-elevated)" strokeWidth="8" />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="var(--sf-primary)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={226.19}
              strokeDashoffset={226.19 - (pct / 100) * 226.19}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{Math.round(pct)}%</span>
          </div>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Today&apos;s focus</p>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sf-text)' }}>{focusMessage}</p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--sf-success)', fontWeight: 700 }}>Streak: {streak} days</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setLearningView('phase2')}
        style={{
          marginTop: 16,
          padding: '10px 20px',
          borderRadius: 10,
          border: 'none',
          background: 'var(--sf-primary)',
          color: 'white',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        Start practice
      </button>
    </section>
  );
}
