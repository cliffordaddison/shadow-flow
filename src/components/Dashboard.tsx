/**
 * Progress dashboard: today, overall, SRS distribution, daily routine, phase entry.
 * UI matches provided Learning Progress & SRS design; logic unchanged. No names.
 */

import { useStore } from '@/store/useStore';
import {
  getDueSentences,
  getMasteredSpeakingCount,
  getUniqueWordsStats,
  getSrsLevelDistribution,
} from '@/store/sentences';
import { getDailyRoutine } from '@/engine/dailyRoutine';
import { getSessions, getPracticeTimeHeatmap, getLearningVelocity, getRetentionRate } from '@/engine/analytics';
import { DailyGoals } from '@/components/DailyGoals';
import type { MasteryLevel } from '@/types';

const LEVELS: MasteryLevel[] = [0, 1, 2, 3, 4, 5, 6];

export function Dashboard() {
  const { setLearningView } = useStore();
  const due = getDueSentences();
  const mastered = getMasteredSpeakingCount();
  const stats = getUniqueWordsStats(true);
  const routine = getDailyRoutine();
  const levelDist = getSrsLevelDistribution();
  const sessions = getSessions(10);
  const heatmap = getPracticeTimeHeatmap();
  const velocity = getLearningVelocity();
  const retentionRate = getRetentionRate();
  const totalInSystem = Object.values(levelDist).reduce((a, b) => a + b, 0);
  const maxLevelCount = Math.max(1, ...LEVELS.map((l) => levelDist[l] ?? 0));
  const vocabPct = stats.nextMilestone > 0 ? Math.min(100, (stats.totalUniqueWords / stats.nextMilestone) * 100) : 0;
  const toNextMilestone = Math.max(0, stats.nextMilestone - stats.totalUniqueWords);
  const maxHeatmapMins = Math.max(1, ...Object.values(heatmap));

  const fluencyFromLevels = (() => {
    const n6 = levelDist[6] ?? 0;
    const n45 = (levelDist[5] ?? 0) + (levelDist[4] ?? 0);
    const n23 = (levelDist[3] ?? 0) + (levelDist[2] ?? 0);
    const n01 = (levelDist[1] ?? 0) + (levelDist[0] ?? 0);
    const total = totalInSystem || 1;
    return {
      nativeLike: Math.round((n6 / total) * 100),
      advanced: Math.round((n45 / total) * 100),
      intermediate: Math.round((n23 / total) * 100),
      learning: Math.round((n01 / total) * 100),
    };
  })();

  const cardStyle: React.CSSProperties = {
    background: 'var(--sf-bg-card)',
    border: '1px solid var(--sf-border)',
    borderRadius: 16,
    padding: 24,
  };

  return (
    <main style={{ flex: 1, overflow: 'auto', background: 'var(--sf-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 4vw + 1rem, 2.25rem)', fontWeight: 800, letterSpacing: '-0.025em', marginBottom: 8 }}>
                Dashboard
              </h1>
              <p style={{ margin: 0, color: 'var(--sf-text-muted)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--sf-success)' }}>verified</span>
                {' '}
                You&apos;ve mastered <strong style={{ color: 'var(--sf-text)' }}>{stats.totalUniqueWords} unique words</strong>. Keep it up!
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLearningView('phase2')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 20px',
                borderRadius: 12,
                border: 'none',
                background: 'var(--sf-bg-elevated)',
                color: 'var(--sf-text)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>bolt</span>
              {' '}
              Quick Practice
            </button>
          </div>
        </div>

        <div className="dashboard-layout">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="dashboard-cards">
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today&apos;s Stats</h3>
                  <span className="material-symbols-outlined" style={{ padding: 8, background: 'rgba(59,130,246,0.1)', color: 'var(--sf-primary)', borderRadius: 8 }}>query_stats</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{due.length}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--sf-text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>Sentences Due</p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--sf-success)' }}>{sessions.length > 0 ? `${retentionRate}%` : '—'}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--sf-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Accuracy</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--sf-primary)' }}>{velocity}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--sf-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Reps (7d)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ ...cardStyle, position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: '100%' }}>Vocab Mastery</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
                  <div style={{ position: 'relative', width: 112, height: 112, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 112 112">
                      <circle cx="56" cy="56" r="48" fill="transparent" stroke="var(--sf-bg-elevated)" strokeWidth="8" />
                      <circle
                        cx="56"
                        cy="56"
                        r="48"
                        fill="transparent"
                        stroke="var(--sf-primary)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={301.59}
                        strokeDashoffset={301.59 - (vocabPct / 100) * 301.59}
                        style={{ transition: 'stroke-dashoffset 0.5s' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stats.totalUniqueWords}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sf-text-muted)' }}>/ {stats.nextMilestone}</span>
                    </div>
                  </div>
                  <p style={{ margin: '16px 0 0', fontSize: 12, fontWeight: 700, color: 'var(--sf-text-dim)' }}>{toNextMilestone} words to next milestone</p>
                </div>
              </div>

              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Practice by hour</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 48 }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      title={`${h}:00 – ${Math.round(heatmap[h] ?? 0)} min`}
                      style={{
                        flex: 1,
                        minWidth: 4,
                        height: `${Math.max(4, ((heatmap[h] ?? 0) / maxHeatmapMins) * 100)}%`,
                        background: (heatmap[h] ?? 0) > 0 ? 'var(--sf-primary)' : 'var(--sf-bg-elevated)',
                        borderRadius: '2px 2px 0 0',
                      }}
                    />
                  ))}
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--sf-text-dim)', fontWeight: 600 }}>Minutes by hour of day (all sessions)</p>
              </div>

              <div style={cardStyle}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Routine</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {routine.map((s, i) => (
                    <div
                      key={s.session}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: 8,
                        borderRadius: 8,
                        background: i === 0 ? 'rgba(16,185,129,0.08)' : 'var(--sf-bg-elevated)',
                        border: `1px solid ${i === 0 ? 'rgba(16,185,129,0.2)' : 'var(--sf-border)'}`,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20, fontWeight: 700, color: i === 0 ? 'var(--sf-success)' : 'var(--sf-text-dim)' }}>
                        {i === 0 ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: i === 0 ? 'var(--sf-success)' : 'var(--sf-text-muted)', textTransform: 'capitalize' }}>{s.session} Session</p>
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--sf-text-dim)' }}>Review • {s.reviewCount} · New • {s.newSentencesCount} · Writing • {s.writingCount}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ ...cardStyle, padding: 32 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.025em' }}>SRS Level Distribution</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--sf-text-dim)' }}>Inventory of active recall items by memory strength</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--sf-primary)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sf-text-dim)', textTransform: 'uppercase' }}>Active Mastery</span>
                </div>
              </div>
              <div className="dashboard-srs-chart" style={{ height: 256, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, padding: '0 16px' }}>
                {LEVELS.map((lvl) => {
                  const count = levelDist[lvl] ?? 0;
                  const h = maxLevelCount > 0 ? (count / maxLevelCount) * 100 : 0;
                  const isMax = count === maxLevelCount && count > 0;
                  return (
                    <div key={lvl} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: '100%', background: 'var(--sf-bg-elevated)', borderRadius: '8px 8px 0 0', height: '100%', position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(8, h)}%`,
                            background: isMax ? 'var(--sf-primary)' : 'rgba(59,130,246,0.5)',
                            borderRadius: '8px 8px 0 0',
                            boxShadow: isMax ? '0 -4px 12px rgba(59,130,246,0.3)' : undefined,
                          }}
                        />
                        <span style={{ position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 700, color: isMax ? 'var(--sf-primary)' : 'var(--sf-text-muted)' }}>{count}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isMax ? 'var(--sf-primary)' : 'var(--sf-text-dim)' }}>Lvl {lvl}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <DailyGoals />
            <div style={{ ...cardStyle, padding: 32, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 32px', fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Fluency Progression</h3>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Native-like</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sf-primary)' }}>{fluencyFromLevels.nativeLike}%</span>
                  </div>
                  <div style={{ height: 8, width: '100%', background: 'var(--sf-bg-elevated)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fluencyFromLevels.nativeLike}%`, background: '#6366f1', borderRadius: 9999 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Advanced Mastery</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sf-primary)' }}>{fluencyFromLevels.advanced}%</span>
                  </div>
                  <div style={{ height: 8, width: '100%', background: 'var(--sf-bg-elevated)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fluencyFromLevels.advanced}%`, background: '#8b5cf6', borderRadius: 9999 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Intermediate Fluency</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sf-primary)' }}>{fluencyFromLevels.intermediate}%</span>
                  </div>
                  <div style={{ height: 8, width: '100%', background: 'var(--sf-bg-elevated)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fluencyFromLevels.intermediate}%`, background: 'var(--sf-primary)', borderRadius: 9999 }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sf-text-muted)' }}>Learning / Beginner</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--sf-primary)' }}>{fluencyFromLevels.learning}%</span>
                  </div>
                  <div style={{ height: 8, width: '100%', background: 'var(--sf-bg-elevated)', borderRadius: 9999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${fluencyFromLevels.learning}%`, background: 'var(--sf-border)', borderRadius: 9999 }} />
                  </div>
                </div>
              </div>
              {stats.recentWords && stats.recentWords.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--sf-text-muted)', textTransform: 'uppercase' }}>Recently mastered words</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {stats.recentWords.slice(0, 10).map((w) => (
                    <span key={w} style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--sf-bg-elevated)', fontSize: 12, fontWeight: 600, color: 'var(--sf-text)' }}>{w}</span>
                  ))}
                </div>
              </div>
            )}
            {stats.totalUniqueWords > 0 && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--sf-bg-elevated)', borderRadius: 8, border: '1px solid var(--sf-border)' }}>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--sf-text-dim)', fontWeight: 700, textTransform: 'uppercase' }}>Word of the day</p>
                <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--sf-primary)' }}>
                  {stats.recentWords?.[0] ?? Array.from({ length: 1 }, (_, i) => stats.recentWords?.[i % (stats.recentWords?.length ?? 1)] ?? '—')[0]}
                </p>
              </div>
            )}
            <div style={{ marginTop: 48, padding: 20, background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(139,92,246,0.05))', borderRadius: 12, border: '1px solid var(--sf-border)', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#8b5cf6', marginBottom: 8 }}>auto_awesome</span>
                <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>Estimated Proficiency</h4>
                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--sf-primary)' }}>Based on SRS levels</p>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--sf-text-dim)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.02em' }}>From active recall strength</p>
              </div>
            </div>
          </div>
        </div>

        <section style={{ marginTop: 32, ...cardStyle, padding: 24 }}>
          <h3 style={{ margin: '0 0 24px', fontSize: '1.125rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Learning Phases</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <PhaseButton label="Phase 1: Exposure" desc="English + French, TTS 5×, mark exposed" onClick={() => setLearningView('phase1')} />
            <PhaseButton label="Phase 2: Speaking" desc="English prompt, speak French, get feedback" onClick={() => setLearningView('phase2')} />
            <PhaseButton label="Phase 3: Drill" desc="English only, recall French (no hint)" onClick={() => setLearningView('phase3')} disabled={mastered < 50 || due.length < 20} />
            <PhaseButton label="Phase 4: Writing" desc="Type French for mastered sentences" onClick={() => setLearningView('phase4')} disabled={mastered < 1} />
          </div>
        </section>
      </div>
    </main>
  );
}

function PhaseButton({ label, desc, onClick, disabled }: Readonly<{ label: string; desc: string; onClick: () => void; disabled?: boolean }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '14px 18px',
        borderRadius: 12,
        border: '1px solid var(--sf-border)',
        background: disabled ? 'var(--sf-bg-elevated)' : 'rgba(59,130,246,0.1)',
        color: disabled ? 'var(--sf-text-dim)' : 'var(--sf-primary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        maxWidth: 220,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--sf-text-muted)' }}>{desc}</div>
    </button>
  );
}
