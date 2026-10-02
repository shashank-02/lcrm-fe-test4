import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, Phone } from 'lucide-react';
import { Avatar, Empty, PageHeader, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtRelative, fmtDateTime } from '@/lib/utils';
import { DASHBOARD_WIDGETS, sortVisible } from '@/lib/uiconfig';
import { useAuth, useCan } from '@/store/auth';
import { useBootstrap } from '@/store/bootstrap';
import type { Activity } from '@/types';

interface Dashboard { kpis: Record<string, number>; funnel: { id: string; name: string; color: string; count: number; isWon: boolean; isLost: boolean }[]; byStatus: { id: string; name: string; color: string; count: number }[]; bySource: { id: string; name: string; count: number }[]; myFollowUps: { id: string; name: string; phone: string; nextFollowUpAt: string; status: string; stage: string }[] }
interface AgentRow { userId: string; name: string; avatarColor?: string; teamName: string; total: number; won: number; contactedInRange: number; callsInRange: number; conversionRate: number }
const PALETTE = ['#185FA5', '#1B8A5A', '#B7791F', '#7C3AED', '#C23B3B', '#0891B2', '#BE185D', '#4338CA'];
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5, color: 'var(--text)' }, cursor: { fill: 'var(--surface-2)' } };

/**
 * Role-aware dashboard. Which KPI cards and charts appear — and in what order — comes from
 * Administration → Dashboards (Organisation.settings.dashboards[role]); widgets that need a permission the
 * current user lacks are skipped. The data queries only run for widgets that are actually shown.
 */
export default function DashboardPage() {
  const me = useAuth((s) => s.user)!; const can = useCan(); const { boot } = useBootstrap();
  const layout = useMemo(() => {
    const cfg = boot.org?.settings.dashboards?.[me.role] ?? DASHBOARD_WIDGETS.map((w, i) => ({ key: w.key, label: '', visible: true, order: i }));
    return sortVisible(cfg).filter((i) => { const w = DASHBOARD_WIDGETS.find((x) => x.key === i.key); return w && (!w.perm || can(w.perm)); }).map((i) => ({ ...i, label: i.label || DASHBOARD_WIDGETS.find((x) => x.key === i.key)!.label }));
  }, [boot.org, me.role, can]);
  const has = (k: string) => layout.some((i) => i.key === k);
  const d = useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get<{ data: Dashboard }>('/reports/dashboard')).data.data });
  const trend = useQuery({ queryKey: ['trend', 14], enabled: has('chart.trend'), queryFn: async () => { const to = new Date(); const from = new Date(Date.now() - 13 * 86_400_000); return (await api.get<{ data: { date: string; created: number; contacted: number; calls: number }[] }>(`/reports/trend?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`)).data.data; } });
  const feed = useQuery({ queryKey: ['activity-feed'], queryFn: async () => (await api.get<{ data: Activity[] }>('/reports/activity-feed')).data.data, enabled: has('chart.teamActivity') && can('report.view_team', 'report.view_org') });
  const board = useQuery({ queryKey: ['agent-leaderboard'], enabled: has('chart.agentLeaderboard') && can('report.view_team', 'report.view_org'), queryFn: async () => { const to = new Date(); const from = new Date(Date.now() - 29 * 86_400_000); return (await api.get<{ data: AgentRow[] }>(`/reports/performance?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`)).data.data; } });
  const k = d.data?.kpis;
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (d.isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;
  if (!k) return <Empty title="Nothing to show yet" />;

  const KPI: Record<string, { value: number; to: string; tone?: string; extra?: React.ReactNode }> = {
    'kpi.followUpsToday': { value: k.followUpsToday, to: '/leads?tab=followup_today', tone: 'text-primary' },
    'kpi.overdue': { value: k.overdue, to: '/leads?tab=overdue', tone: k.overdue ? 'text-danger' : undefined },
    'kpi.contactedToday': { value: k.contactedToday, to: '/leads?tab=contacted_today' },
    'kpi.createdToday': { value: k.createdToday, to: '/leads?tab=created_today' },
    'kpi.assignedToday': { value: k.assignedToday, to: '/leads?tab=assigned_today' },
    'kpi.unassigned': { value: k.unassigned, to: '/leads?tab=unassigned', tone: k.unassigned ? 'text-warning' : undefined },
    'kpi.openLeads': { value: k.openLeads, to: '/leads' },
    'kpi.won': { value: k.won, to: '/leads', tone: 'text-success', extra: <span className="text-[13px] text-ink-3 font-normal ml-1.5">{k.conversionRate}%</span> },
    'kpi.topUpsDue': { value: k.topUpsDue ?? 0, to: can('topup.view') ? '/reports?tab=topup' : '/leads', tone: k.topUpsDue ? 'text-warning' : undefined },
    'kpi.onlineAgents': { value: k.onlineAgents ?? 0, to: '/reports?tab=sessions', tone: 'text-success' },
  };
  const kpis = layout.filter((i) => i.key.startsWith('kpi.') && KPI[i.key]);
  const charts = layout.filter((i) => i.key.startsWith('chart.'));
  const cols = Math.min(8, Math.max(2, kpis.length));
  const funnelMax = Math.max(1, ...(d.data?.funnel.map((x) => x.count) ?? [1]));

  const chart = (key: string, label: string) => {
    switch (key) {
      case 'chart.funnel': return (
        <section key={key} className="card p-4 lg:col-span-2 min-w-0"><h2 className="text-[14px] font-semibold mb-3">{label}</h2>
          <div className="space-y-2">{d.data!.funnel.map((s) => (
            <Link to={`/leads?stageId=${s.id}`} key={s.id} className="grid grid-cols-[minmax(90px,120px)_1fr_40px] sm:grid-cols-[150px_1fr_48px] items-center gap-2 sm:gap-3 text-[13px] group">
              <span className="truncate text-ink-2 group-hover:text-ink">{s.name}</span>
              <span className="h-6 rounded bg-surface-2 overflow-hidden"><span className="block h-full rounded transition-[width]" style={{ width: `${Math.max(2, (s.count / funnelMax) * 100)}%`, backgroundColor: s.color }} /></span>
              <span className="text-right tabular-nums font-medium">{s.count}</span>
            </Link>))}</div></section>);
      case 'chart.bySource': return (
        <section key={key} className="card p-4 min-w-0"><h2 className="text-[14px] font-semibold mb-1">{label}</h2><p className="text-[12px] text-ink-3 mb-2">Last 30 days</p>
          {d.data!.bySource.length ? (
            <div className="flex flex-wrap items-center gap-3"><div className="w-[140px] h-[140px] shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={d.data!.bySource} dataKey="count" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">{d.data!.bySource.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer></div>
              <ul className="text-[12.5px] space-y-1 flex-1 min-w-[140px]">{d.data!.bySource.slice(0, 7).map((s, i) => <li key={s.id} className="flex items-center gap-2 min-w-0"><span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="truncate text-ink-2">{s.name}</span><span className="ml-auto tabular-nums">{s.count}</span></li>)}</ul></div>
          ) : <p className="text-[13px] text-ink-3 py-8 text-center">No leads created in this period.</p>}</section>);
      case 'chart.trend': return (
        <section key={key} className="card p-4 lg:col-span-2 min-w-0"><h2 className="text-[14px] font-semibold mb-3">{label}</h2>
          <div className="w-full h-[220px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend.data ?? []} margin={{ left: -20, right: 8, top: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} minTickGap={16} /><YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip {...tip} /><Line type="monotone" dataKey="created" name="Created" stroke="#185FA5" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="contacted" name="Contacted" stroke="#1B8A5A" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="calls" name="Calls logged" stroke="#B7791F" strokeWidth={2} dot={false} strokeDasharray="4 3" /></LineChart></ResponsiveContainer></div></section>);
      case 'chart.byStatus': return (
        <section key={key} className="card p-4 min-w-0"><h2 className="text-[14px] font-semibold mb-3">{label}</h2>
          {d.data!.byStatus.length ? <div className="w-full h-[220px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={d.data!.byStatus} layout="vertical" margin={{ left: 4, right: 12 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11.5, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} /><Tooltip {...tip} /><Bar dataKey="count" radius={[0, 4, 4, 0]}>{d.data!.byStatus.map((s) => <Cell key={s.id} fill={s.color} />)}</Bar></BarChart></ResponsiveContainer></div> : <p className="text-[13px] text-ink-3 py-8 text-center">No statuses set yet.</p>}</section>);
      case 'chart.myFollowUps': return (
        <section key={key} className="card p-4 min-w-0"><h2 className="text-[14px] font-semibold mb-3 inline-flex items-center gap-2"><CalendarClock size={15} className="text-primary" /> {label}</h2>
          {d.data!.myFollowUps?.length ? <ul className="divide-y divide-line">{d.data!.myFollowUps.map((l) => <li key={l.id} className="py-2 flex items-center gap-2 text-[13px] min-w-0"><Link to={`/leads/${l.id}?call=1`} className="font-medium hover:text-primary truncate">{l.name || l.phone}</Link><span className="text-ink-3 text-[12px] truncate hidden sm:inline">{l.status || l.stage}</span><span className="ml-auto tabular-nums text-ink-2 whitespace-nowrap">{fmtDateTime(l.nextFollowUpAt).slice(11)}</span><a href={`tel:${l.phone}`} className="text-ink-3 hover:text-primary" title="Call"><Phone size={14} /></a></li>)}</ul> : <p className="text-[13px] text-ink-3 py-6 text-center">No follow-ups scheduled for today.</p>}
          <Link to="/leads?tab=followup_today" className="text-[12.5px] text-primary hover:underline mt-2 inline-block">Open today's follow-ups →</Link></section>);
      case 'chart.agentLeaderboard': return (
        <section key={key} className="card p-4 lg:col-span-2 min-w-0"><h2 className="text-[14px] font-semibold mb-3">{label}</h2>
          {board.isLoading ? <Spinner /> : !board.data?.length ? <p className="text-[13px] text-ink-3">No agent activity in this period.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[480px]"><thead><tr><th className="th">Agent</th><th className="th">Team</th><th className="th text-right">Leads</th><th className="th text-right">Contacted</th><th className="th text-right">Calls</th><th className="th text-right">Won</th><th className="th text-right">Conv %</th></tr></thead><tbody>{[...board.data].sort((a, b) => b.won - a.won || b.contactedInRange - a.contactedInRange).slice(0, 8).map((r) => <tr key={r.userId}><td className="td"><span className="inline-flex items-center gap-2"><Avatar name={r.name} color={r.avatarColor} size={20} />{r.name}</span></td><td className="td text-ink-2">{r.teamName}</td><td className="td text-right tabular-nums">{r.total}</td><td className="td text-right tabular-nums">{r.contactedInRange}</td><td className="td text-right tabular-nums">{r.callsInRange}</td><td className="td text-right tabular-nums text-success font-medium">{r.won}</td><td className="td text-right tabular-nums">{r.conversionRate}%</td></tr>)}</tbody></table></div>}</section>);
      case 'chart.teamActivity': return (
        <section key={key} className="card p-4 lg:col-span-3 min-w-0"><h2 className="text-[14px] font-semibold mb-3">{label}</h2>
          {feed.isLoading ? <Spinner /> : feed.data?.length ? <ul className="grid md:grid-cols-2 gap-x-6 gap-y-2">{feed.data.slice(0, 14).map((a) => <li key={a.id} className="flex items-center gap-2 text-[13px] min-w-0"><Avatar name={a.user?.name ?? 'S'} color={a.user?.avatarColor} size={22} /><span className="truncate min-w-0"><span className="font-medium">{a.user?.name ?? 'System'}</span> <span className="text-ink-2">{a.description}</span>{a.lead && <> · <Link to={`/leads/${a.lead.id}`} className="text-primary hover:underline">{a.lead.name || a.lead.phone}</Link></>}</span><span className="ml-auto text-ink-3 text-[12px] whitespace-nowrap shrink-0">{fmtRelative(a.createdAt)}</span></li>)}</ul> : <p className="text-[13px] text-ink-3">No activity yet.</p>}</section>);
      default: return null;
    }
  };

  return (
    <div className="min-w-0">
      <PageHeader title={`${greet}, ${me.name.split(' ')[0]}`} subtitle="Where your pipeline stands right now." />
      {kpis.length > 0 && (
        <div className={`card grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-line overflow-hidden mb-4 ${cols >= 8 ? 'xl:grid-cols-8 xl:divide-y-0' : cols >= 6 ? 'xl:grid-cols-6' : cols === 5 ? 'xl:grid-cols-5 xl:divide-y-0' : cols === 4 ? 'xl:divide-y-0' : ''}`}>
          {kpis.map((x) => { const v = KPI[x.key]; return (
            <Link key={x.key} to={v.to} className="p-3.5 hover:bg-surface-2 transition-colors min-w-0">
              <p className={`text-[26px] leading-8 font-semibold tabular-nums ${v.tone ?? ''}`}>{v.value}{v.extra}</p>
              <p className="text-[12.5px] text-ink-2 mt-0.5 truncate">{x.label}</p>
            </Link>); })}
        </div>)}
      {charts.length > 0 ? <div className="grid lg:grid-cols-3 gap-4 min-w-0">{charts.map((c) => chart(c.key, c.label))}</div> : kpis.length === 0 ? <Empty title="This dashboard is empty" hint="An administrator can enable KPI cards and charts for your role under Administration → Dashboards." /> : null}
    </div>
  );
}
