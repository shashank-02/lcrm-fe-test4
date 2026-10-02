import type { Role } from '@/types';

/** Mirrors backend/src/common/uiconfig.ts — keys must stay in sync. */
export interface LayoutItem { key: string; label: string; visible: boolean; order: number }
export interface QuickActionItem extends LayoutItem { roles: Role[] }

export const LEAD_TABS: { key: string; label: string }[] = [
  { key: 'basic', label: 'Basic Info' }, { key: 'activities', label: 'Activities' }, { key: 'interactions', label: 'Interactions' },
  { key: 'files', label: 'Files' }, { key: 'notes', label: 'Notes' }, { key: 'tasks', label: 'Tasks' },
];

export const DASHBOARD_WIDGETS: { key: string; label: string; kind: 'kpi' | 'chart'; perm?: string; hint?: string }[] = [
  { key: 'kpi.followUpsToday', label: 'Follow-ups today', kind: 'kpi' }, { key: 'kpi.overdue', label: 'Overdue follow-ups', kind: 'kpi' },
  { key: 'kpi.contactedToday', label: 'Contacted today', kind: 'kpi' }, { key: 'kpi.createdToday', label: 'Created today', kind: 'kpi' },
  { key: 'kpi.assignedToday', label: 'Assigned today', kind: 'kpi' }, { key: 'kpi.unassigned', label: 'Unassigned', kind: 'kpi' },
  { key: 'kpi.openLeads', label: 'Open leads', kind: 'kpi' }, { key: 'kpi.won', label: 'Won · conversion', kind: 'kpi' },
  { key: 'kpi.topUpsDue', label: 'Top-up follow-ups due', kind: 'kpi' }, { key: 'kpi.onlineAgents', label: 'Agents online now', kind: 'kpi', perm: 'report.view_team', hint: 'Needs team reporting permission' },
  { key: 'chart.funnel', label: 'Pipeline funnel', kind: 'chart' }, { key: 'chart.bySource', label: 'Leads by source', kind: 'chart' },
  { key: 'chart.trend', label: 'Created vs contacted (14 days)', kind: 'chart' }, { key: 'chart.byStatus', label: 'Leads by status', kind: 'chart' },
  { key: 'chart.teamActivity', label: 'Team activity feed', kind: 'chart', perm: 'report.view_team', hint: 'Needs team reporting permission' }, { key: 'chart.myFollowUps', label: 'My follow-ups today', kind: 'chart' },
  { key: 'chart.agentLeaderboard', label: 'Agent leaderboard (30 days)', kind: 'chart', perm: 'report.view_team', hint: 'Needs team reporting permission' },
];

export const QUICK_ACTIONS: { key: string; label: string; perm?: string; hint: string }[] = [
  { key: 'call_log', label: 'Add Call Log', perm: 'call.create', hint: 'Side panel: call type, status, sub-status, notes, follow-up' }, { key: 'note', label: 'Add Note', perm: 'note.create', hint: 'Quick note with optional reminder' },
  { key: 'topup', label: 'Top-up follow-up', perm: 'topup.action', hint: 'Shown only while a reminder is open' }, { key: 'call', label: 'Call', perm: 'lead.communicate', hint: 'tel: link, logs the touch' },
  { key: 'whatsapp', label: 'WhatsApp', perm: 'lead.communicate', hint: 'wa.me deep link with template' }, { key: 'email', label: 'Email', perm: 'lead.communicate', hint: 'mailto: deep link with template' },
  { key: 'followup', label: 'Set follow-up', perm: 'lead.set_followup', hint: 'Set / change the next follow-up date' }, { key: 'stage', label: 'Update stage', perm: 'lead.update_stage', hint: 'Move the lead to another stage' },
  { key: 'status', label: 'Update status', perm: 'lead.update_status', hint: 'Change status with a remark' }, { key: 'assign', label: 'Assign owner', perm: 'lead.assign', hint: 'Reassign the lead' },
  { key: 'files', label: 'Lead files', perm: 'file.view', hint: 'Jump to the Files tab' },
];

export const tabLabel = (key: string, override?: string) => override || LEAD_TABS.find((t) => t.key === key)?.label || key.replace(/^tab:/, '');
export const sortVisible = <T extends LayoutItem>(items: T[]) => [...items].filter((i) => i.visible).sort((a, b) => a.order - b.order);
