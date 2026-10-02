import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LayoutDashboard, LayoutPanelTop, MousePointerClick } from 'lucide-react';
import { Tabs } from '@/components/ui';
import { LayoutEditor } from '@/components/LayoutEditor';
import { api, errorMessage } from '@/lib/api';
import { ROLE_LABEL } from '@/lib/utils';
import { DASHBOARD_WIDGETS, LEAD_TABS, QUICK_ACTIONS, type LayoutItem, type QuickActionItem } from '@/lib/uiconfig';
import { useBootstrap, useInvalidateBootstrap } from '@/store/bootstrap';
import type { Role } from '@/types';

const ROLES: Role[] = ['admin', 'branch_manager', 'team_lead', 'agent'];

function useSaveSettings(label: string) {
  const inv = useInvalidateBootstrap();
  return useMutation({ mutationFn: (settings: Record<string, unknown>) => api.patch('/organisation', { settings }), onSuccess: () => { toast.success(`${label} saved`); inv(); }, onError: (e) => toast.error(errorMessage(e)) });
}

/** Lead page → which info tabs appear and in what order (system tabs + custom field tabs). */
export function LeadTabsEditor() {
  const { boot } = useBootstrap(); const save = useSaveSettings('Lead tabs');
  const [items, setItems] = useState<LayoutItem[]>([]);
  useEffect(() => { setItems((boot.org?.settings.leadTabs ?? []).map((t) => ({ ...t, label: t.label ?? '' }))); }, [boot.org]);
  const catalogue = [...LEAD_TABS, ...Array.from(new Set(boot.fields.map((f) => f.tab))).filter((t) => t && t !== 'Basic Info').map((t) => ({ key: `tab:${t}`, label: t, hint: 'Custom field tab' }))];
  const reset = () => setItems(catalogue.map((c, i) => ({ key: c.key, label: '', visible: true, order: i })));
  return (
    <div>
      <p className="text-[13px] text-ink-3 mb-3 inline-flex items-start gap-1.5"><LayoutPanelTop size={14} className="mt-0.5 shrink-0" /> Controls the tabs on the lead detail page for everyone. Basic Info cannot be hidden; a tab that is hidden keeps its data.</p>
      <LayoutEditor items={items.map((i) => (i.key === 'basic' ? { ...i, visible: true } : i))} onChange={(n) => setItems(n.map((i) => (i.key === 'basic' ? { ...i, visible: true } : i)))} catalogue={catalogue} saving={save.isPending} onSave={() => save.mutate({ leadTabs: items.map((i, idx) => ({ ...i, order: idx, visible: i.key === 'basic' ? true : i.visible })) })} onReset={reset} />
    </div>
  );
}

/** Dashboard → per-role KPI cards and charts. */
export function DashboardsPage() {
  const { boot } = useBootstrap(); const save = useSaveSettings('Dashboard layout');
  const [role, setRole] = useState<Role>('agent');
  const [all, setAll] = useState<Record<Role, LayoutItem[]>>({ admin: [], branch_manager: [], team_lead: [], agent: [] });
  useEffect(() => { const d = boot.org?.settings.dashboards; if (d) setAll({ admin: d.admin ?? [], branch_manager: d.branch_manager ?? [], team_lead: d.team_lead ?? [], agent: d.agent ?? [] }); }, [boot.org]);
  const items = all[role] ?? [];
  const kpis = items.filter((i) => i.key.startsWith('kpi.')), charts = items.filter((i) => i.key.startsWith('chart.'));
  const set = (next: LayoutItem[]) => setAll((a) => ({ ...a, [role]: next }));
  const merge = (part: LayoutItem[], kind: 'kpi' | 'chart') => { const other = items.filter((i) => !i.key.startsWith(`${kind}.`)); const base = kind === 'kpi' ? [...part, ...other] : [...other, ...part]; set(base.map((i, idx) => ({ ...i, order: idx }))); };
  const reset = () => set(DASHBOARD_WIDGETS.map((w, i) => ({ key: w.key, label: '', visible: true, order: i })));
  return (
    <div>
      <div className="mb-3"><h2 className="text-[16px] font-semibold inline-flex items-center gap-2"><LayoutDashboard size={16} className="text-primary" /> Dashboards</h2><p className="text-[13px] text-ink-3 mt-0.5">Choose which KPI cards and charts each role sees and in what order. Widgets that need a permission the role lacks are skipped automatically.</p></div>
      <Tabs tabs={ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] }))} value={role} onChange={setRole} className="mb-4" />
      <h3 className="text-[13px] font-semibold text-ink-2 mb-2">KPI cards</h3>
      <LayoutEditor items={kpis} onChange={(n) => merge(n, 'kpi')} catalogue={DASHBOARD_WIDGETS} saving={save.isPending} onSave={() => save.mutate({ dashboards: { [role]: items.map((i, idx) => ({ ...i, order: idx })) } })} onReset={reset} />
      <h3 className="text-[13px] font-semibold text-ink-2 mt-6 mb-2">Charts & panels</h3>
      <LayoutEditor items={charts} onChange={(n) => merge(n, 'chart')} catalogue={DASHBOARD_WIDGETS} saving={save.isPending} onSave={() => save.mutate({ dashboards: { [role]: items.map((i, idx) => ({ ...i, order: idx })) } })} />
    </div>
  );
}

/** Lead page → floating quick-action buttons (bottom-right). */
export function QuickActionsPage() {
  const { boot } = useBootstrap(); const save = useSaveSettings('Quick actions');
  const [items, setItems] = useState<QuickActionItem[]>([]);
  useEffect(() => { setItems((boot.org?.settings.quickActions ?? []).map((q) => ({ ...q, label: q.label ?? '', roles: q.roles ?? [] }))); }, [boot.org]);
  const reset = () => setItems(QUICK_ACTIONS.map((a, i) => ({ key: a.key, label: '', visible: ['call_log', 'note', 'topup', 'call', 'whatsapp', 'email'].includes(a.key), order: i, roles: [] })));
  return (
    <div>
      <div className="mb-3"><h2 className="text-[16px] font-semibold inline-flex items-center gap-2"><MousePointerClick size={16} className="text-primary" /> Quick actions</h2><p className="text-[13px] text-ink-3 mt-0.5">The floating buttons on the lead page. Each button still requires its own permission; restrict to roles to hide it from everyone else. Order runs top → bottom.</p></div>
      <LayoutEditor items={items} onChange={setItems} catalogue={QUICK_ACTIONS} saving={save.isPending} onSave={() => save.mutate({ quickActions: items.map((i, idx) => ({ ...i, order: idx })) })} onReset={reset}
        renderExtra={(it, update) => <div className="flex flex-wrap gap-1">{ROLES.map((r) => { const on = it.roles.length === 0 || it.roles.includes(r); return <button key={r} type="button" title={it.roles.length ? 'Click to toggle role' : 'All roles — click to restrict'} className={`pill h-7 ${on ? 'border-primary text-primary bg-primary-soft' : ''}`} onClick={() => { const cur = it.roles.length ? it.roles : [...ROLES]; const next = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]; update({ roles: next.length === ROLES.length ? [] : next } as Partial<QuickActionItem>); }}>{ROLE_LABEL[r]}</button>; })}</div>} />
    </div>
  );
}
