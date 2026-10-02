import { NavLink, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { Columns3, Database, FileUp, GitBranch, LayoutDashboard, LayoutList, ListOrdered, MessageSquareText, MousePointerClick, Puzzle, Radio, ScrollText, Settings, ShieldCheck, Shuffle, Users, Users2, Zap } from 'lucide-react';
import { BackButton, Tabs } from '@/components/ui';
import { useBootstrap } from '@/store/bootstrap';
import { useCan } from '@/store/auth';
import { cn } from '@/lib/utils';
import UsersPage from './UsersPage';
import TeamsPage from './TeamsPage';
import PermissionsPage from './PermissionsPage';
import ImportsPage from './ImportsPage';
import SettingsPage from './SettingsPage';
import { ConfigCrudPage } from './ConfigCrudPage';
import { directivesSpec, fieldsSpec, rulesSpec, sourcesSpec, stagesSpec, statusesSpec, templatesSpec } from './configSpecs';
import { AuditLogPage, ColumnGroupsPage, ColumnsPage, FeaturePermissionsPage, LayoutPage, PrioritizationPage, fbEventsSpec, viewGroupsSpec, viewTabsSpec } from './projectPages';
import { DashboardsPage, LeadTabsEditor, QuickActionsPage } from './layoutPages';

/**
 * One Administration workspace. Every administrative function has exactly one page; the former
 * "Project Administration" routes redirect here (see PROJECT_ADMIN_REDIRECTS) so bookmarks keep working.
 */
type Item = { to: string; label: string; icon: React.ElementType; perm: string[] };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'People & access', items: [
    { to: 'users', label: 'Users', icon: Users, perm: ['admin.users'] }, { to: 'teams', label: 'Teams', icon: Users2, perm: ['admin.teams'] },
    { to: 'permissions', label: 'Roles & Permissions', icon: ShieldCheck, perm: ['admin.permissions', 'admin.project'] } ] },
  { title: 'Lead management', items: [
    { to: 'pipeline', label: 'Pipeline', icon: GitBranch, perm: ['admin.pipeline'] }, { to: 'lead-layout', label: 'Lead Layout', icon: LayoutList, perm: ['admin.fields', 'admin.project'] },
    { to: 'columns', label: 'List Columns', icon: Columns3, perm: ['admin.project'] }, { to: 'views', label: 'View Tabs', icon: Puzzle, perm: ['admin.project'] },
    { to: 'rules', label: 'Assignment Rules', icon: Shuffle, perm: ['admin.assignment_rules'] }, { to: 'prioritization', label: 'Prioritisation', icon: ListOrdered, perm: ['admin.project'] },
    { to: 'quick-actions', label: 'Quick Actions', icon: MousePointerClick, perm: ['admin.settings', 'admin.project'] } ] },
  { title: 'Communication & content', items: [
    { to: 'templates', label: 'Message Templates', icon: MessageSquareText, perm: ['admin.templates'] }, { to: 'fb-events', label: 'FB Conversion Events', icon: Zap, perm: ['admin.project'] } ] },
  { title: 'Data', items: [{ to: 'imports', label: 'Imports', icon: FileUp, perm: ['lead.import', 'admin.imports'] }, { to: 'sources', label: 'Lead Sources', icon: Radio, perm: ['admin.pipeline'] }] },
  { title: 'System', items: [
    { to: 'settings', label: 'System Settings', icon: Settings, perm: ['admin.settings'] }, { to: 'dashboards', label: 'Dashboards', icon: LayoutDashboard, perm: ['admin.settings', 'admin.project'] },
    { to: 'audit-log', label: 'Audit Log', icon: ScrollText, perm: ['admin.audit', 'admin.project'] } ] },
];
export { Database };

/** Old Project Administration paths → canonical Administration pages. */
export const PROJECT_ADMIN_REDIRECTS: Record<string, string> = {
  '': 'settings', settings: 'settings', members: 'users', teams: 'teams', templates: 'templates', sources: 'sources', stages: 'pipeline?tab=stages', statuses: 'pipeline?tab=statuses',
  'lead-settings': 'lead-layout', 'lead-settings/layout': 'lead-layout', 'lead-settings/columns': 'columns', 'lead-settings/column-groups': 'columns?tab=groups',
  views: 'views', 'views/tabs': 'views', 'views/groups': 'views?tab=groups', prioritization: 'prioritization', automations: 'rules', 'automations/assignment': 'rules', 'automations/fb-events': 'fb-events',
  'feature-permissions': 'permissions?tab=features', 'audit-log': 'audit-log',
};
export function ProjectAdminRedirect() {
  const loc = useLocation();
  const rest = loc.pathname.replace(/^\/project-admin\/?/, '').replace(/\/+$/, '');
  return <Navigate to={`/admin/${PROJECT_ADMIN_REDIRECTS[rest] ?? 'settings'}`} replace />;
}

export default function AdminRoutes() {
  const can = useCan(); const { boot } = useBootstrap();
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => can(...i.perm)) })).filter((g) => g.items.length);
  const first = groups[0]?.items[0]?.to;
  if (!first) return <Navigate to="/" replace />;
  const allowed = new Set(groups.flatMap((g) => g.items.map((i) => i.to)));
  const guard = (to: string, el: React.ReactNode) => (allowed.has(to) ? el : <Navigate to={first} replace />);
  const link = (i: Item) => <NavLink key={i.to} to={i.to} className={({ isActive }) => cn('px-2.5 h-8 flex items-center gap-2 rounded-md text-[13.5px] whitespace-nowrap shrink-0', isActive ? 'bg-primary-soft text-primary font-medium' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}><i.icon size={15} className="shrink-0" /> {i.label}</NavLink>;
  return (
    <div className="grid md:grid-cols-[224px_1fr] gap-4 md:gap-6 items-start min-w-0">
      <nav className="flex md:flex-col gap-1 overflow-x-auto scroll-hidden -mx-1 px-1 md:sticky md:top-0" aria-label="Administration">
        <h1 className="hidden md:block text-[12px] font-semibold text-ink-3 px-2.5 mb-1">Administration</h1>
        {groups.map((g) => <div key={g.title} className="flex md:flex-col gap-0.5 md:mb-3 shrink-0"><p className="hidden md:block px-2.5 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{g.title}</p>{g.items.map(link)}<span className="md:hidden w-px h-6 self-center bg-line mx-1" /></div>)}
      </nav>
      <div className="min-w-0">
        <BackButton fallback="/" className="mb-2" />
        <Routes>
          <Route index element={<Navigate to={first} replace />} />
          <Route path="users" element={guard('users', <UsersPage />)} />
          <Route path="teams" element={guard('teams', <TeamsPage />)} />
          <Route path="permissions" element={guard('permissions', <RolesPermissionsPage />)} />
          <Route path="pipeline" element={guard('pipeline', <PipelinePage />)} />
          <Route path="sources" element={guard('sources', <ConfigCrudPage spec={sourcesSpec()} />)} />
          <Route path="lead-layout" element={guard('lead-layout', <LeadLayoutPage />)} />
          <Route path="fields" element={<Navigate to="../lead-layout?tab=fields" replace />} />
          <Route path="columns" element={guard('columns', <ColumnsHubPage />)} />
          <Route path="views" element={guard('views', <ViewsHubPage />)} />
          <Route path="rules" element={guard('rules', <ConfigCrudPage spec={rulesSpec(boot)} />)} />
          <Route path="prioritization" element={guard('prioritization', <PrioritizationPage />)} />
          <Route path="quick-actions" element={guard('quick-actions', <QuickActionsPage />)} />
          <Route path="templates" element={guard('templates', <ConfigCrudPage spec={templatesSpec()} />)} />
          <Route path="fb-events" element={guard('fb-events', <ConfigCrudPage spec={fbEventsSpec(boot)} />)} />
          <Route path="imports" element={guard('imports', <ImportsPage />)} />
          <Route path="settings" element={guard('settings', <SettingsPage />)} />
          <Route path="dashboards" element={guard('dashboards', <DashboardsPage />)} />
          <Route path="audit-log" element={guard('audit-log', <AuditLogPage />)} />
          <Route path="*" element={<Navigate to={first} replace />} />
        </Routes>
      </div>
    </div>
  );
}

/** Tab state kept in the URL (?tab=) so redirects from old routes and bookmarks land on the right sub-tab. */
function useUrlTab<T extends string>(def: T, allowed: readonly T[]): [T, (t: T) => void] {
  const [sp, setSp] = useSearchParams();
  const cur = (sp.get('tab') as T | null);
  const value = cur && allowed.includes(cur) ? cur : def;
  return [value, (t) => { const n = new URLSearchParams(sp); t === def ? n.delete('tab') : n.set('tab', t); setSp(n, { replace: true }); }];
}

function PipelinePage() {
  const { boot } = useBootstrap();
  const [tab, setTab] = useUrlTab<'stages' | 'statuses' | 'directives'>('stages', ['stages', 'statuses', 'directives']);
  return (
    <div>
      <Tabs tabs={[{ key: 'stages', label: 'Stages' }, { key: 'statuses', label: 'Statuses' }, { key: 'directives', label: 'Stage directives' }]} value={tab} onChange={setTab} className="mb-4" />
      {tab === 'stages' && <ConfigCrudPage spec={stagesSpec()} />}
      {tab === 'statuses' && <ConfigCrudPage spec={statusesSpec(boot)} />}
      {tab === 'directives' && <ConfigCrudPage spec={directivesSpec(boot)} />}
    </div>
  );
}
function LeadLayoutPage() {
  const { boot } = useBootstrap(); const can = useCan();
  const [tab, setTab] = useUrlTab<'layout' | 'fields' | 'tabs'>('layout', ['layout', 'fields', 'tabs']);
  const tabs = [{ key: 'layout' as const, label: 'Page layout' }, { key: 'fields' as const, label: 'All fields' }, ...(can('admin.project', 'admin.settings') ? [{ key: 'tabs' as const, label: 'Info tabs' }] : [])];
  return (
    <div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} className="mb-4" />
      {tab === 'layout' && <LayoutPage />}
      {tab === 'fields' && <ConfigCrudPage spec={fieldsSpec(boot)} />}
      {tab === 'tabs' && <LeadTabsEditor />}
    </div>
  );
}
function ColumnsHubPage() {
  const [tab, setTab] = useUrlTab<'columns' | 'groups'>('columns', ['columns', 'groups']);
  return <div><Tabs tabs={[{ key: 'columns', label: 'Columns' }, { key: 'groups', label: 'Column groups' }]} value={tab} onChange={setTab} className="mb-4" />{tab === 'columns' ? <ColumnsPage /> : <ColumnGroupsPage />}</div>;
}
function ViewsHubPage() {
  const { boot } = useBootstrap();
  const [tab, setTab] = useUrlTab<'tabs' | 'groups'>('tabs', ['tabs', 'groups']);
  return <div><Tabs tabs={[{ key: 'tabs', label: 'View tabs' }, { key: 'groups', label: 'View groups' }]} value={tab} onChange={setTab} className="mb-4" />{tab === 'tabs' ? <ConfigCrudPage spec={viewTabsSpec(boot)} /> : <ConfigCrudPage spec={viewGroupsSpec()} />}</div>;
}
function RolesPermissionsPage() {
  const can = useCan();
  const [tab, setTab] = useUrlTab<'templates' | 'features'>('templates', ['templates', 'features']);
  const tabs = [...(can('admin.permissions') ? [{ key: 'templates' as const, label: 'Permission templates' }] : []), ...(can('admin.project', 'admin.settings') ? [{ key: 'features' as const, label: 'Feature permissions' }] : [])];
  const value = tabs.some((t) => t.key === tab) ? tab : tabs[0].key;
  return <div><Tabs tabs={tabs} value={value} onChange={setTab} className="mb-4" />{value === 'templates' ? <PermissionsPage /> : <FeaturePermissionsPage />}</div>;
}
