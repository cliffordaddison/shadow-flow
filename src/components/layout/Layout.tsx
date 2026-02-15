import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, type SidebarVariant } from './Sidebar';
import { calculateCEFRLevel } from '@/engine/cefrLevel';
import { getMasteredWords } from '@/store/wordStats';

function getCEFRSubtitle(): string {
  const count = getMasteredWords().length;
  const level = calculateCEFRLevel(count);
  return `Fluency Level: ${level}`;
}

const SIDEBAR_HEADER = { title: 'French Learner' };

const ROUTE_SIDEBAR: Record<string, { variant: SidebarVariant; title: string; subtitle: string; showSessionGoal?: boolean }> = {
  '/upload': { variant: 'listen', ...SIDEBAR_HEADER, subtitle: getCEFRSubtitle() },
  '/listen': { variant: 'listen', ...SIDEBAR_HEADER, subtitle: getCEFRSubtitle() },
  '/settings': { variant: 'settings', ...SIDEBAR_HEADER, subtitle: getCEFRSubtitle() },
  '/speaking': { variant: 'speaking', ...SIDEBAR_HEADER, subtitle: getCEFRSubtitle(), showSessionGoal: true },
  '/writing': { variant: 'writing', ...SIDEBAR_HEADER, subtitle: getCEFRSubtitle(), showSessionGoal: true },
};

function getSidebarConfig(pathname: string) {
  for (const path of Object.keys(ROUTE_SIDEBAR)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return ROUTE_SIDEBAR[path];
    }
  }
  return { variant: 'listen' as SidebarVariant, ...SIDEBAR_HEADER, subtitle: getCEFRSubtitle() };
}

export function Layout() {
  const location = useLocation();
  const config = getSidebarConfig(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <Sidebar
        variant={config.variant}
        title={config.title}
        subtitle={getCEFRSubtitle()}
        showSessionGoal={config.showSessionGoal}
      />
      <main className="flex-1 flex flex-col overflow-y-auto bg-white dark:bg-background-dark min-h-0 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
