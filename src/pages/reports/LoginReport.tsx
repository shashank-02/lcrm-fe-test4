import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Wifi, WifiOff } from 'lucide-react';
import { Avatar, Badge, Button, Empty, Pagination, PillSelect, Spinner } from '@/components/ui';
import { api, downloadFile, errorMessage, qs } from '@/lib/api';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import type { ApiList, LoginSessionRow, LoginSessionSummary } from '@/types';

type SortKey = 'loginAt' | 'endedAt' | 'durationSec' | 'agent';
export const fmtDuration = (sec: number) => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`; };
const fmtClock = (iso: string | null) => (iso ? dayjs(iso).format('hh:mm A') : '—');
const fmtMinutes = (m: number | null) => (m == null ? '—' : dayjs().startOf('day').add(m, 'minute').format('hh:mm A'));

/** Reports → Login & Logout: real sign-in sessions, filterable, sortable, exportable. */
export function LoginReport({ from, to, teamId, userId }: { from: string; to: string; teamId: string; userId: string }) {
  const [status, setStatus] = useState<'all' | 'online' | 'offline'>('all'); const [sortBy, setSortBy] = useState<SortKey>('loginAt'); const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc'); const [page, setPage] = useState(1); const [limit, setLimit] = useState(50);
  const params = { from, to, teamId, userId, status, sortBy, sortDir, page, limit };
  const q = useQuery({ queryKey: ['login-sessions', params], queryFn: async () => (await api.get<ApiList<never> & { data: { items: LoginSessionRow[]; summary: LoginSessionSummary; timezone: string } }>(`/reports/login-sessions${qs(params)}`)).data, placeholderData: (p) => p, refetchInterval: 60_000 });
  const sort = (k: SortKey) => { if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortBy(k); setSortDir(k === 'agent' ? 'asc' : 'desc'); } setPage(1); };
  const icon = (k: SortKey) => (sortBy !== k ? <ArrowUpDown size={12} className="text-ink-3" /> : sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />);
  const s = q.data?.data.summary; const rows = q.data?.data.items ?? [];
  const exportCsv = async () => { try { await downloadFile(`/reports/login-sessions/export${qs({ from, to, teamId, userId, status, sortBy, sortDir })}`, `login-logout-${from}-to-${to}.csv`); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <PillSelect label="Status" value={status === 'all' ? '' : status} onChange={(v) => { setStatus((v || 'all') as typeof status); setPage(1); }} options={[{ value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' }]} />
        <Button size="sm" className="ml-auto" onClick={exportCsv}><Download size={14} /> Export CSV</Button>
      </div>
      <div className="card grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-line overflow-hidden mb-3">
        {[['Total agents', s?.totalAgents ?? '—', ''], ['Currently online', s?.currentlyOnline ?? '—', 'text-success'], ['Login sessions', s?.totalSessions ?? '—', ''], ['Average login time', s ? fmtMinutes(s.avgLoginMinutes) : '—', ''], ['Average session', s ? fmtDuration(s.avgSessionSec) : '—', '']].map(([l, v, tone]) => <div key={l as string} className="p-3.5 min-w-0"><p className={cn('text-[22px] leading-7 font-semibold tabular-nums truncate', tone as string)}>{v as React.ReactNode}</p><p className="text-[12.5px] text-ink-2 mt-0.5">{l as string}</p></div>)}
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scroll-thin">{q.isLoading ? <div className="py-10 flex justify-center"><Spinner /></div> : !rows.length ? <Empty title="No login activity in this range" hint="Sessions are recorded from each successful sign-in; adjust the dates or filters." /> : (
          <table className="w-full min-w-[820px]"><thead><tr>
            <th className="th cursor-pointer hover:text-ink" onClick={() => sort('agent')}><span className="inline-flex items-center gap-1">Agent {icon('agent')}</span></th><th className="th">Team</th><th className="th">Date</th>
            <th className="th cursor-pointer hover:text-ink" onClick={() => sort('loginAt')}><span className="inline-flex items-center gap-1">Login time {icon('loginAt')}</span></th>
            <th className="th cursor-pointer hover:text-ink" onClick={() => sort('endedAt')}><span className="inline-flex items-center gap-1">Logout time {icon('endedAt')}</span></th>
            <th className="th cursor-pointer hover:text-ink" onClick={() => sort('durationSec')}><span className="inline-flex items-center gap-1">Total session {icon('durationSec')}</span></th><th className="th">Status</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2/60">
                <td className="td"><span className="inline-flex items-center gap-2"><Avatar name={r.agentName} size={22} />{r.agentName}</span></td><td className="td text-ink-2">{r.teamName || '—'}</td><td className="td tabular-nums">{dayjs(r.date).format('DD/MM/YYYY')}</td>
                <td className="td tabular-nums">{fmtClock(r.loginAt)}</td>
                <td className="td tabular-nums">{r.logoutAt ? <>{fmtClock(r.logoutAt)}{r.endReason === 'expired' && <span className="block text-[11px] text-ink-3">session expired · last seen {fmtClock(r.lastSeenAt)}</span>}{r.endReason === 'logout_all' && <span className="block text-[11px] text-ink-3">signed out everywhere</span>}{(r.endReason === 'revoked' || r.endReason === 'password_change') && <span className="block text-[11px] text-ink-3">ended by admin</span>}</> : <span className="text-ink-3">—{r.status === 'offline' && <span className="block text-[11px]">inactive since {fmtClock(r.lastSeenAt)}</span>}</span>}</td>
                <td className="td tabular-nums">{fmtDuration(r.durationSec)}{r.status === 'online' && <span className="text-[11px] text-ink-3"> · live</span>}</td>
                <td className="td">{r.status === 'online' ? <Badge color="#1B8A5A" soft><Wifi size={11} className="mr-1" /> Online</Badge> : <Badge color="#6B7280" soft><WifiOff size={11} className="mr-1" /> {r.logoutAt ? 'Logged out' : 'Offline'}</Badge>}</td>
              </tr>))}</tbody></table>)}</div>
        <div className="px-3 py-2 border-t border-line bg-surface-2/40"><Pagination page={page} totalPages={q.data?.meta.totalPages ?? 1} total={q.data?.meta.total ?? 0} limit={limit} onPage={setPage} onLimit={(l) => { setLimit(l); setPage(1); }} sizes={[25, 50, 100]} /></div>
      </div>
      <p className="text-[12px] text-ink-3 mt-2">Times are shown in {q.data?.data.timezone ?? 'the organisation timezone'}. Open sessions count as online while the app was used in the last 30 minutes; sessions abandoned without signing out are closed at their last activity and marked “session expired”.</p>
    </div>
  );
}
