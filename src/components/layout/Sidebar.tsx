import { NavLink, useLocation } from 'react-router-dom';
import { getProgressSnapshot } from '@/engine/metrics';

export type SidebarVariant = 'upload' | 'listen' | 'settings' | 'speaking' | 'writing';

interface SidebarProps {
  readonly variant: SidebarVariant;
  /** App title, e.g. "FluentFrench" or "French Learner" */
  readonly title: string;
  /** Subtitle under title, e.g. "Dashboard" or "Fluency Level: A2" */
  readonly subtitle: string;
  /** Show session goal block (Speaking & Writing, same style) */
  readonly showSessionGoal?: boolean;
}

const NAV_ITEMS: { to: string; label: string; icon: string; filledIcon?: boolean }[] = [
  { to: '/listen', label: 'Listen & Repeat', icon: 'headphones', filledIcon: true },
  { to: '/speaking', label: 'Speaking', icon: 'record_voice_over' },
  { to: '/writing', label: 'Writing', icon: 'edit_note' },
  { to: '/upload', label: 'Upload File', icon: 'cloud_upload', filledIcon: true },
];

const SESSION_GOAL_TOTAL = 50;

const VARIANT_TO_PROGRESS_MODE: Record<SidebarVariant, 'listen' | 'speak' | 'write'> = {
  listen: 'listen',
  speaking: 'speak',
  writing: 'write',
  upload: 'listen',
  settings: 'listen',
};

export function Sidebar({
  variant,
  title,
  subtitle,
  showSessionGoal = false,
}: Readonly<SidebarProps>) {
  const { pathname } = useLocation();
  const snapshot = getProgressSnapshot(VARIANT_TO_PROGRESS_MODE[variant]);
  const sessionDone = snapshot.wordsSeenToday;
  const sessionTotal = SESSION_GOAL_TOTAL;
  const sessionPct = sessionTotal > 0 ? Math.min(100, (sessionDone / sessionTotal) * 100) : 0;

  return (
    <aside className="w-14 sm:w-16 md:w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col z-10 relative transition-[width] duration-200">
      <div className="p-3 md:p-6 flex items-center gap-3 flex-shrink-0">
        <div
          className={
            variant === 'upload'
              ? 'size-8 md:size-10 bg-primary rounded-lg flex items-center justify-center text-white shadow-lg shadow-primary/30 flex-shrink-0'
              : 'size-8 md:size-10 rounded-full bg-primary flex items-center justify-center text-white flex-shrink-0'
          }
        >
          <span className="material-symbols-outlined text-lg md:text-base">translate</span>
        </div>
        <div className="hidden md:block min-w-0">
          <h1 className="text-base font-bold leading-tight text-slate-900 dark:text-white truncate">
            {title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider truncate">
            {subtitle}
          </p>
        </div>
      </div>

      <nav className="flex-1 px-2 md:px-4 py-4 space-y-1 min-w-0">
        {NAV_ITEMS.map(({ to, label, icon, filledIcon }) => {
          const isActive = pathname === to || pathname.startsWith(to + '/');
          return (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive: active }) =>
                `flex items-center gap-3 px-2 md:px-3 py-2.5 rounded-lg transition-colors justify-center md:justify-start ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={isActive && filledIcon ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {icon}
              </span>
              <span className={`text-sm font-medium hidden md:inline ${isActive ? 'font-semibold' : ''} truncate`}>
                {label}
              </span>
            </NavLink>
          );
        })}
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
          <NavLink
            to="/settings"
            title="Settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-2 md:px-3 py-2.5 rounded-lg transition-colors justify-center md:justify-start ${
                isActive
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <span
              className="material-symbols-outlined flex-shrink-0"
              style={pathname === '/settings' ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              settings
            </span>
            <span className="text-sm font-medium hidden md:inline truncate">Settings</span>
          </NavLink>
        </div>
      </nav>

      {showSessionGoal && (
        <div className="hidden md:block p-4 mt-auto">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Session Goal
              </span>
              <span className="text-xs font-bold text-primary">{sessionDone}/{sessionTotal}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${sessionPct}%` }} />
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
