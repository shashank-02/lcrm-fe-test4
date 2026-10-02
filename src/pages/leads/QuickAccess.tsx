import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlarmClock, CalendarClock, Check, FolderOpen, Layers, Mail, MessageCircle, Phone, PhoneCall, StickyNote, Tag, UserPlus, Wallet, X } from 'lucide-react';
import { Badge, Button, Checkbox, Drawer, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { cn, fmtDate, fmtDateTime } from '@/lib/utils';
import { QUICK_ACTIONS, sortVisible } from '@/lib/uiconfig';
import { useBootstrap } from '@/store/bootstrap';
import { useAuth, useCan } from '@/store/auth';
import type { Lead, Stage, TopUpOutcome, TopUpReminder } from '@/types';
import { safeRefresh, useLeadInvalidate } from './shared';

const CALL_STATUSES = [['connected', 'Connected'], ['not_connected', 'Not connected'], ['busy', 'Busy'], ['no_answer', 'No answer'], ['switched_off', 'Switched off'], ['wrong_number', 'Wrong number'], ['voicemail', 'Voicemail']] as const;
const ICONS: Record<string, { icon: React.ElementType; bg: string }> = {
  call_log: { icon: PhoneCall, bg: 'bg-[#1a3a5c]' }, note: { icon: StickyNote, bg: 'bg-[#7C3AED]' }, topup: { icon: Wallet, bg: 'bg-warning' }, call: { icon: Phone, bg: 'bg-primary' }, whatsapp: { icon: MessageCircle, bg: 'bg-[#25D366]' }, email: { icon: Mail, bg: 'bg-[#C23B3B]' },
  followup: { icon: CalendarClock, bg: 'bg-[#0891B2]' }, stage: { icon: Layers, bg: 'bg-[#4338CA]' }, status: { icon: Tag, bg: 'bg-[#BE185D]' }, assign: { icon: UserPlus, bg: 'bg-[#B7791F]' }, files: { icon: FolderOpen, bg: 'bg-[#6B7280]' },
};

/**
 * Floating quick-action bar (bottom-right). Which buttons appear, in what order and for which roles is configured in
 * Administration → Quick Actions; every button still needs its own permission. Each modal follows the same lifecycle:
 * submit → API succeeds → close + reset → refresh (never blocking) → toast. Failed primary actions keep the modal open.
 */
export function QuickAccessBar({ lead, openCall, onOpenCall, openTopUp, onOpenTopUp, onFollowUp, onStage, onStatus, onAssign, onFiles }: { lead: Lead; openCall: boolean; onOpenCall: (v: boolean) => void; openTopUp: boolean; onOpenTopUp: (v: boolean) => void; onFollowUp: () => void; onStage: (s: Stage) => void; onStatus: () => void; onAssign: () => void; onFiles: () => void }) {
  const can = useCan(); const { boot } = useBootstrap(); const inv = useLeadInvalidate(); const me = useAuth((s) => s.user)!;
  const [note, setNote] = useState(false); const [stagePick, setStagePick] = useState(false);
  const [channel, setChannel] = useState<null | 'whatsapp' | 'email'>(null);
  const canEdit = lead.canEdit !== false;
  const topUpOpen = !!lead.topUp && ['scheduled', 'due', 'snoozed'].includes(lead.topUp.status);
  const actions = useMemo(() => {
    const cfg = boot.org?.settings.quickActions?.length ? boot.org.settings.quickActions : QUICK_ACTIONS.map((a, i) => ({ key: a.key, label: '', visible: ['call_log', 'note', 'topup', 'call', 'whatsapp', 'email'].includes(a.key), order: i, roles: [] }));
    return sortVisible(cfg).filter((a) => { const def = QUICK_ACTIONS.find((x) => x.key === a.key); if (!def) return false; if (a.roles.length && !a.roles.includes(me.role)) return false; if (def.perm && !can(def.perm)) return false; if (a.key === 'topup') return topUpOpen; if (['followup', 'stage', 'status'].includes(a.key)) return canEdit; return true; }).map((a) => ({ ...a, label: a.label || QUICK_ACTIONS.find((x) => x.key === a.key)!.label }));
  }, [boot.org, me.role, can, topUpOpen, canEdit]);
  const callTouch = useMutation({
    mutationFn: () => api.post<{ data: { link: string } }>(`/leads/${lead.id}/communicate`, { channel: 'call' }),
    onSuccess: (r) => { window.open(r.data.data.link, '_self'); safeRefresh(() => inv(lead.id)); setTimeout(() => onOpenCall(true), 400); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const run: Record<string, () => void> = {
    call_log: () => onOpenCall(true), note: () => setNote(true), topup: () => onOpenTopUp(true), call: () => { if (!callTouch.isPending) callTouch.mutate(); }, whatsapp: () => setChannel('whatsapp'), email: () => setChannel('email'),
    followup: onFollowUp, stage: () => setStagePick(true), status: onStatus, assign: onAssign, files: onFiles,
  };
  const btn = 'group relative h-11 w-11 rounded-full shadow-pop grid place-items-center text-white transition-transform hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-40 disabled:hover:scale-100';
  const tip = 'pointer-events-none absolute right-[52px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-navy text-white text-[12px] px-2 py-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity shadow-pop';
  return (
    <>
      <div className="fixed right-3 sm:right-4 bottom-3 sm:bottom-4 z-30 flex flex-col gap-2 items-end max-h-[calc(100dvh-80px)] overflow-visible" role="toolbar" aria-label="Quick access">
        {actions.map((a) => { const meta = ICONS[a.key]; const Icon = meta.icon; const disabled = a.key === 'email' && !lead.email; const pulse = a.key === 'topup' && lead.topUp?.status === 'due';
          return <button key={a.key} className={cn(btn, pulse ? 'bg-danger animate-pulse' : meta.bg)} disabled={disabled || (a.key === 'call' && callTouch.isPending)} onClick={run[a.key]} aria-label={a.label}><Icon size={18} /><span className={tip}>{a.key === 'email' && !lead.email ? 'No email on lead' : a.key === 'call' ? `Call ${lead.phone}` : a.key === 'topup' ? `${a.label} ${lead.topUp?.status === 'due' ? '— due now' : `on ${fmtDate(lead.topUp?.dueAt)}`}` : a.label}</span></button>; })}
      </div>
      <CallLogDrawer lead={lead} open={openCall} onClose={() => onOpenCall(false)} />
      <QuickNoteModal lead={lead} open={note} onClose={() => setNote(false)} />
      <TopUpModal lead={lead} open={openTopUp} onClose={() => onOpenTopUp(false)} onLogCall={() => { onOpenTopUp(false); onOpenCall(true); }} />
      <ChannelModal lead={lead} channel={channel} onClose={() => setChannel(null)} />
      <StagePickModal open={stagePick} onClose={() => setStagePick(false)} lead={lead} onPick={(s) => { setStagePick(false); onStage(s); }} />
    </>
  );
}

/** WhatsApp / Email compose: the deep link opens only after the touch is logged; failures keep the draft. */
function ChannelModal({ lead, channel, onClose }: { lead: Lead; channel: null | 'whatsapp' | 'email'; onClose: () => void }) {
  const { boot } = useBootstrap(); const inv = useLeadInvalidate();
  const [templateId, setTemplateId] = useState(''); const [message, setMessage] = useState(''); const [subject, setSubject] = useState('');
  useEffect(() => { if (channel) { setTemplateId(''); setMessage(''); setSubject(''); } }, [channel]);
  const templates = boot.templates.filter((t) => t.channel === channel);
  const send = useMutation({
    mutationFn: (ch: 'whatsapp' | 'email') => api.post<{ data: { link: string } }>(`/leads/${lead.id}/communicate`, { channel: ch, templateId: templateId || undefined, message: templateId ? undefined : message || undefined, subject: templateId ? undefined : subject || undefined }),
    onSuccess: (r) => { const link = r.data.data.link; onClose(); window.open(link, '_blank', 'noopener'); safeRefresh(() => inv(lead.id)); toast.success(channel === 'whatsapp' ? 'WhatsApp opened and logged' : 'Email opened and logged'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const preview = templateId ? boot.templates.find((t) => t.id === templateId)?.body : message;
  const invalid = channel === 'email' && !templateId && !subject.trim();
  return (
    <Modal open={channel !== null} onClose={onClose} title={channel === 'whatsapp' ? `WhatsApp ${lead.name || lead.phone}` : `Email ${lead.email}`} width="max-w-md"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={send.isPending} disabled={invalid} onClick={() => channel && send.mutate(channel)}>{send.isPending ? 'Opening…' : `Open ${channel === 'whatsapp' ? 'WhatsApp' : 'mail app'}`}</Button></>}>
      <div className="space-y-3">
        <Field label="Template"><Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}><option value="">Write my own</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        {!templateId && channel === 'email' && <Field label="Subject" required><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>}
        {!templateId ? <Field label="Message"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[96px]" placeholder="Hi {{name}}, …" /></Field> : <div className="rounded-md bg-surface-2 p-3 text-[13px] whitespace-pre-wrap text-ink-2">{preview}</div>}
        <p className="text-[12px] text-ink-3">Placeholders like {'{{name}}'} or {'{{owner.name}}'} are filled in before opening. The touch is logged on the lead once.</p>
      </div>
    </Modal>
  );
}

/** Quick "move to stage" picker that hands off to the full StageModal (directives, remarks, required fields). */
function StagePickModal({ open, onClose, lead, onPick }: { open: boolean; onClose: () => void; lead: Lead; onPick: (s: Stage) => void }) {
  const { boot } = useBootstrap();
  return (
    <Modal open={open} onClose={onClose} title="Update stage" description={`Current stage: ${lead.stage?.name ?? '—'}`} width="max-w-sm" footer={<Button onClick={onClose}>Cancel</Button>}>
      <div className="grid gap-1.5">{boot.stages.filter((s) => s.isActive !== false).map((s) => <button key={s.id} type="button" disabled={s.id === lead.stageId} onClick={() => onPick(s)} className={cn('flex items-center gap-2 h-10 px-3 rounded-md border border-line text-left text-[13.5px] hover:border-primary hover:bg-primary-soft disabled:opacity-50 disabled:cursor-default')}><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.name}{s.id === lead.stageId && <Badge className="ml-auto">Current</Badge>}</button>)}</div>
    </Modal>
  );
}

/** Submit Call Log — side panel with Call Type, Call Status, Status, Sub-Status, Notes and next follow-up. */
export function CallLogDrawer({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const { boot } = useBootstrap(); const can = useCan(); const inv = useLeadInvalidate(); const qc = useQueryClient();
  const [direction, setDirection] = useState<'outbound' | 'inbound'>('outbound'); const [callStatus, setCallStatus] = useState(''); const [statusId, setStatusId] = useState(''); const [subStatus, setSubStatus] = useState(''); const [notes, setNotes] = useState(''); const [dur, setDur] = useState(''); const [follow, setFollow] = useState(''); const [updateStatus, setUpdateStatus] = useState(true); const [error, setError] = useState('');
  useEffect(() => { if (open) { setDirection('outbound'); setCallStatus(''); setStatusId(lead.statusId ?? ''); setSubStatus(''); setNotes(''); setDur(''); setFollow(''); setUpdateStatus(true); setError(''); } }, [open, lead.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const statuses = boot.statuses.filter((s) => !s.stageIds.length || (lead.stageId && s.stageIds.includes(lead.stageId)));
  const subs = useMemo(() => boot.statuses.find((s) => s.id === statusId)?.subStatuses ?? [], [boot.statuses, statusId]);
  const add = useMutation({
    mutationFn: () => {
      if (follow && new Date(follow).getTime() < Date.now() - 60_000) throw new Error('Next follow-up must be in the future');
      if (dur && (Number(dur) < 0 || Number(dur) > 600)) throw new Error('Duration must be between 0 and 600 minutes');
      return api.post(`/leads/${lead.id}/calls`, { direction, callStatus: callStatus || undefined, outcomeStatusId: statusId || null, subStatus: subStatus || undefined, notes, durationSec: dur ? Math.round(Number(dur) * 60) : 0, followUpAt: follow ? new Date(follow).toISOString() : undefined, updateLeadStatus: updateStatus });
    },
    onSuccess: () => { onClose(); toast.success('Call log saved'); safeRefresh(() => { qc.invalidateQueries({ queryKey: ['lead-calls', lead.id] }); inv(lead.id); }); },
    onError: (e) => setError(errorMessage(e)),
  });
  const quick = (h: number) => { const d = new Date(); d.setHours(d.getHours() + h); setFollow(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); };
  return (
    <Drawer open={open} onClose={onClose} title="Submit Call Log" description={`Fill in the details for ${lead.name || lead.phone}`} width="max-w-lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={add.isPending} disabled={!statusId && !notes.trim() && !callStatus} onClick={() => add.mutate()}><Check size={14} /> {add.isPending ? 'Saving…' : 'Submit'}</Button></>}>
      <div className="space-y-4">
        {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Call type" required><Select value={direction} onChange={(e) => setDirection(e.target.value as 'outbound' | 'inbound')}><option value="outbound">Outgoing</option><option value="inbound">Incoming</option></Select></Field>
          <Field label="Call status"><Select value={callStatus} onChange={(e) => setCallStatus(e.target.value)}><option value="">—</option>{CALL_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Status" required><Select value={statusId} onChange={(e) => { setStatusId(e.target.value); setSubStatus(''); }}><option value="">Select…</option>{statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Sub-status"><Select value={subStatus} onChange={(e) => setSubStatus(e.target.value)} disabled={!subs.length}><option value="">{subs.length ? 'Select…' : 'No sub-statuses configured'}</option>{subs.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
        </div>
        <Field label="Call notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[110px]" placeholder="What was discussed, objections, next steps…" autoFocus /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Duration (minutes)"><Input type="number" min={0} max={600} value={dur} onChange={(e) => setDur(e.target.value)} /></Field>
          <Field label="Next follow-up / callback on"><Input type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} /></Field>
        </div>
        <div className="flex gap-1.5 flex-wrap -mt-1">{[['+1 hour', 1], ['+3 hours', 3], ['Tomorrow', 24], ['+3 days', 72]].map(([l, h]) => <button key={l as string} type="button" className="pill" onClick={() => quick(h as number)}><AlarmClock size={12} /> {l}</button>)}</div>
        {statusId && can('lead.update_status') && <Checkbox checked={updateStatus} onChange={setUpdateStatus} label="Also set this as the lead's status" />}
        <p className="text-[12px] text-ink-3">The call is linked to this lead and appears under Interactions immediately. It counts as a contact and updates the follow-up date.</p>
      </div>
    </Drawer>
  );
}

export function QuickNoteModal({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const inv = useLeadInvalidate(); const qc = useQueryClient();
  const [body, setBody] = useState(''); const [remind, setRemind] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (open) { setBody(''); setRemind(''); setError(''); } }, [open]);
  const add = useMutation({
    mutationFn: () => { if (remind && new Date(remind).getTime() < Date.now()) throw new Error('Reminder time must be in the future'); return api.post(`/leads/${lead.id}/notes`, { body: body.trim(), remindAt: remind ? new Date(remind).toISOString() : undefined }); },
    onSuccess: () => { onClose(); toast.success('Note added'); safeRefresh(() => { qc.invalidateQueries({ queryKey: ['lead-notes', lead.id] }); inv(lead.id); }); },
    onError: (e) => setError(errorMessage(e)),
  });
  const submit = () => { if (body.trim() && !add.isPending) add.mutate(); };
  return (
    <Modal open={open} onClose={onClose} title="Add note" description={`${lead.name || lead.phone} · saved with your name and time`} width="max-w-md" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!body.trim()} loading={add.isPending} onClick={submit}><Check size={14} /> {add.isPending ? 'Saving…' : 'Save note'}</Button></>}>
      <div className="space-y-3">
        {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
        <Textarea autoFocus value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[110px]" placeholder="Type your note…" onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }} />
        <Field label="Remind me (optional)" hint="You will get a notification at this time"><Input type="datetime-local" value={remind} onChange={(e) => setRemind(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

const OUTCOMES: { value: TopUpOutcome; label: string }[] = [{ value: 'interested', label: 'Interested in top-up' }, { value: 'not_interested', label: 'Not interested' }, { value: 'call_back_later', label: 'Call back later' }, { value: 'unable_to_reach', label: 'Unable to reach' }, { value: 'already_taken', label: 'Top-up already taken' }, { value: 'other', label: 'Other' }];
export const OUTCOME_LABEL = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label])) as Record<string, string>;

/** Top-up follow-up outcome dialog with call / snooze / dismiss actions. */
export function TopUpModal({ lead, open, onClose, onLogCall }: { lead: Lead; open: boolean; onClose: () => void; onLogCall: () => void }) {
  const inv = useLeadInvalidate();
  const [outcome, setOutcome] = useState<TopUpOutcome | ''>(''); const [notes, setNotes] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (open) { setOutcome(''); setNotes(''); setError(''); } }, [open]);
  const r = lead.topUp;
  const act = useMutation({ mutationFn: ({ action, body }: { action: 'complete' | 'snooze' | 'dismiss'; body?: Record<string, unknown> }) => api.post(`/topup-reminders/${r!.id}/${action}`, body ?? {}), onSuccess: (_d, v) => { onClose(); toast.success(v.action === 'complete' ? 'Top-up follow-up recorded' : v.action === 'snooze' ? 'Reminder snoozed for a week' : 'Reminder dismissed'); safeRefresh(() => inv(lead.id)); }, onError: (e) => setError(errorMessage(e)) });
  if (!r) return null;
  return (
    <Modal open={open} onClose={onClose} title={<span className="inline-flex items-center gap-2"><Wallet size={18} className="text-warning" /> Top-up follow-up</span>} description={`${lead.name || lead.phone} · disbursed ${fmtDate(r.disbursedAt)} · reminder ${fmtDate(r.dueAt)}`} width="max-w-md"
      footer={<><Button variant="ghost" className="mr-auto text-ink-3" disabled={act.isPending} onClick={() => act.mutate({ action: 'dismiss' })}><X size={14} /> Dismiss</Button><Button disabled={act.isPending} onClick={() => act.mutate({ action: 'snooze', body: { days: 7 } })}><AlarmClock size={14} /> Remind me in a week</Button><Button variant="primary" disabled={!outcome} loading={act.isPending} onClick={() => act.mutate({ action: 'complete', body: { outcome, notes } })}><Check size={14} /> {act.isPending ? 'Saving…' : 'Save outcome'}</Button></>}>
      <div className="space-y-3">
        {error && <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
        <p className="text-[13.5px] text-ink-2">This customer's loan was disbursed about {monthsSince(r)} ago. Contact them and check whether they are interested in a loan top-up.</p>
        <div className="flex gap-2 flex-wrap"><Button size="sm" onClick={() => window.open(`tel:${lead.phone}`, '_self')}><Phone size={14} /> Call customer</Button><Button size="sm" onClick={onLogCall}><PhoneCall size={14} /> Log interaction</Button></div>
        <Field label="Outcome" required><div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">{OUTCOMES.map((o) => <button key={o.value} type="button" onClick={() => setOutcome(o.value)} className={cn('pill h-9 justify-start', outcome === o.value && 'border-primary text-primary bg-primary-soft')}>{o.label}</button>)}</div></Field>
        <Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[64px]" placeholder="What the customer said…" /></Field>
      </div>
    </Modal>
  );
}
const monthsSince = (r: TopUpReminder) => { const m = Math.max(1, Math.round((Date.now() - new Date(r.disbursedAt).getTime()) / (30 * 86_400_000))); return `${m} month${m > 1 ? 's' : ''}`; };

/** Compact status card shown on the lead page. */
export function TopUpCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const r = lead.topUp; const can = useCan();
  if (!r) return null;
  const tone: Record<string, string> = { scheduled: '#185FA5', due: '#C23B3B', snoozed: '#B7791F', completed: '#1B8A5A', dismissed: '#6B7280' };
  return (
    <div className="card p-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] mt-3">
      <span className="inline-flex items-center gap-1.5 font-semibold"><Wallet size={15} className="text-warning" /> Top-Up Follow-Up:</span>
      <Badge color={tone[r.status]}>{r.status === 'due' ? 'Due now' : r.status[0].toUpperCase() + r.status.slice(1)}</Badge>
      <span className="text-ink-2">Disbursed on <span className="text-ink tabular-nums">{fmtDate(r.disbursedAt)}</span></span>
      {r.status !== 'completed' ? <span className="text-ink-2">Reminder on <span className="text-ink tabular-nums">{fmtDate(r.snoozedUntil ?? r.dueAt)}</span></span> : <><span className="text-ink-2">Follow-up date <span className="text-ink tabular-nums">{fmtDateTime(r.completedAt)}</span></span><span className="text-ink-2">Outcome <span className="text-ink font-medium">{OUTCOME_LABEL[r.outcome] ?? r.outcome}</span></span>{r.outcomeNotes && <span className="text-ink-3 truncate max-w-[280px]" title={r.outcomeNotes}>“{r.outcomeNotes}”</span>}</>}
      {['scheduled', 'due', 'snoozed'].includes(r.status) && can('topup.action') && <Button size="sm" variant={r.status === 'due' ? 'primary' : 'secondary'} className="ml-auto" onClick={onOpen}>Record outcome</Button>}
    </div>
  );
}
