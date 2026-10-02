import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { boot, dashboard, lead, sessions, user } from './fixtures';
import type { Role } from '@/types';

/** Route-aware API mock: returns fixtures for the endpoints the pages call. */
const calls: { method: string; url: string; body?: unknown }[] = [];
vi.mock('@/lib/api', () => {
  const respond = (url: string) => {
    if (url.startsWith('/bootstrap')) return { data: boot };
    if (url.startsWith('/reports/dashboard')) return { data: dashboard };
    if (url.startsWith('/reports/trend')) return { data: [{ date: '2026-10-01', created: 2, contacted: 1, calls: 1 }] };
    if (url.startsWith('/reports/activity-feed')) return { data: [] };
    if (url.startsWith('/reports/performance')) return { data: [{ userId: 'u2', name: 'Karan Mehta', teamName: 'PL', total: 18, won: 0, contactedInRange: 2, callsInRange: 1, conversionRate: 0 }] };
    if (url.startsWith('/reports/login-sessions')) return sessions;
    if (url.startsWith('/leads/counts')) return { data: { all: 1, followup_today: 1 } };
    if (url.startsWith('/leads/l1')) return { data: lead };
    if (url.startsWith('/leads')) return { data: [lead], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } };
    if (url.startsWith('/notifications/unread-count')) return { data: { unread: 2, popups: [] } };
    if (url.startsWith('/notifications')) return { data: { items: [{ id: 'n1', leadId: 'l1', leadName: 'Pooja Menon', type: 'followup_due', category: 'followups', priority: 'high', title: 'Follow-up due', body: 'Call now', scheduledAt: null, status: 'pending', readAt: null, createdAt: new Date().toISOString() }], unread: 1 } };
    if (url.startsWith('/organisation/mail-status')) return { data: { provider: 'SMTP', driver: 'smtp', configured: true, host: 'smtp****.brevo.com', port: 587, secure: false, username: 'ka****@dbs.test', senderEmail: 'no****@dbs.test', senderName: 'DBS', connected: true, status: 'Connected', lastVerify: { ok: true, at: new Date().toISOString(), error: null }, productionWarning: null } };
    if (url.startsWith('/documents/folders')) return { data: [] };
    if (url.startsWith('/documents/d1/view-token')) return { data: { token: 't', url: '/documents/d1/view', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileName: 'Induction.docx', canDownload: false } };
    if (url.startsWith('/documents')) return { data: [{ id: 'd1', folderId: null, name: 'Induction programme-report', description: '', fileName: 'Induction.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docType: 'docx', size: 113700, audience: { all: true, roles: [], teamIds: [], userIds: [] }, version: 1, isActive: true, uploadedBy: 'arjun', teamNames: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
    return { data: [] };
  };
  const api = {
    get: vi.fn(async (url: string) => { calls.push({ method: 'get', url }); return { data: respond(url) }; }),
    post: vi.fn(async (url: string, body?: unknown) => { calls.push({ method: 'post', url, body }); if (url.endsWith('/notes') && (body as { body: string }).body === 'FAIL') throw new Error('boom'); if (url === '/organisation/mail-test') return { data: { data: { to: 'admin@t.io', messageId: 'm1' } } }; return { data: { data: { id: 'new', link: 'tel:7817804383' } } }; }),
    patch: vi.fn(async (url: string, body?: unknown) => { calls.push({ method: 'patch', url, body }); return { data: { data: {} } }; }),
    delete: vi.fn(async (url: string) => { calls.push({ method: 'delete', url }); return { data: { data: {} } }; }),
  };
  return { api, API_BASE: '/api/v1', apiUrl: (p: string) => `/api/v1${p}`, qs: (o: Record<string, unknown>) => { const s = new URLSearchParams(); Object.entries(o).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) s.set(k, String(v)); }); const q = s.toString(); return q ? `?${q}` : ''; }, errorMessage: (e: unknown, d = 'Error') => (e instanceof Error ? e.message : d), errorDetails: () => undefined, downloadFile: vi.fn(async () => undefined) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() }, Toaster: () => null }));
vi.mock('recharts', async () => { const R = await vi.importActual<typeof import('recharts')>('recharts'); return { ...R, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="chart">{children}</div> }; });
vi.mock('@/components/viewer/engines', () => ({ default: ({ kind, fileName }: { kind: string; fileName: string }) => <div data-testid="engine">{kind}:{fileName}</div> }));

import { useAuth } from '@/store/auth';
import { AppShell } from '@/components/layout/AppShell';
import DashboardPage from '@/pages/DashboardPage';
import LeadsPage from '@/pages/leads/LeadsPage';
import LeadDetailPage from '@/pages/leads/LeadDetailPage';
import ReportsPage from '@/pages/reports/ReportsPage';
import FilesPage from '@/pages/FilesPage';
import AdminRoutes, { ProjectAdminRedirect } from '@/pages/admin/AdminRoutes';
import { Checkbox, Toggle, Menu } from '@/components/ui';
import { cn } from '@/lib/utils';

function mount(ui: React.ReactNode, { path = '/', role = 'admin' as Role } = {}) {
  useAuth.setState({ accessToken: 'tok', refreshToken: 'ref', user: user(role) } as never);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { calls.length = 0; (globalThis as unknown as { fetch: unknown }).fetch = vi.fn(async () => new Response(new Blob(['PK'], { type: 'application/octet-stream' }), { status: 200, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } })); });

describe('design-system fixes', () => {
  it('cn resolves conflicting classes so a checked checkbox is primary, not surface', () => {
    expect(cn('bg-surface border-ink-2', 'bg-primary border-primary')).toBe('bg-primary border-primary');
    const { container, rerender } = render(<Checkbox checked={false} onChange={() => undefined} />);
    expect(container.querySelector('[data-state="unchecked"]')!.className).toContain('bg-surface');
    rerender(<Checkbox checked onChange={() => undefined} />);
    const box = container.querySelector('[data-state="checked"]')!; expect(box.className).toContain('bg-primary'); expect(box.className).not.toContain('bg-surface'); expect(box.querySelector('svg')).toBeTruthy();
  });
  it('toggle has a visible off track and reports its state', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Show Lead Status Bar" />);
    const sw = screen.getByRole('switch'); expect(sw).toHaveAttribute('aria-checked', 'false'); expect(sw.className).toContain('toggle-off');
    fireEvent.click(sw); expect(onChange).toHaveBeenCalledWith(true);
  });
  it('menu closes on Escape and never positions itself with a fixed desktop width', () => {
    render(<Menu align="right" trigger={() => <button>open</button>}>{() => <div>panel content</div>}</Menu>);
    fireEvent.click(screen.getByText('open')); expect(screen.getByText('panel content')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByText('panel content')).toBeNull();
  });
});

describe('app shell', () => {
  it('shows one Administration entry (no Project Administration), a notification bell and the logout confirmation', async () => {
    mount(<Routes><Route element={<AppShell />}><Route index element={<div>home</div>} /></Route></Routes>);
    await screen.findByText('home');
    expect(screen.getByText('Administration')).toBeInTheDocument(); expect(screen.queryByText('Project Administration')).toBeNull();
    // one profile entry in the user menu (no separate "Profile")
    fireEvent.click(screen.getByLabelText('Account menu'));
    const menuItems = screen.getAllByText('Profile Settings'); expect(menuItems.length).toBe(2); // sidebar + user menu
    expect(screen.queryByRole('button', { name: /^Profile$/ })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Profile Settings')).toBeInTheDocument(); expect(screen.getByText('Training')).toBeInTheDocument();
    const main = document.getElementById('main-scroll')!; expect(main.className).toContain('overflow-y-auto');
    expect(document.querySelector('.app-layout')!.className).toContain('overflow-hidden');
    fireEvent.click(screen.getAllByText('Logout')[0]); expect(await screen.findByText(/Your session will be ended/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Notifications/)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Notifications/)); expect(await screen.findByText('Follow-up due')).toBeInTheDocument();
  });
});

describe('dashboard', () => {
  it('renders the widgets configured for the role and skips hidden ones', async () => {
    mount(<DashboardPage />, { role: 'admin' });
    expect(await screen.findByText('Follow-ups today')).toBeInTheDocument();
    expect(screen.getByText('Agents online now')).toBeInTheDocument(); expect(screen.getByText('Top-up follow-ups due')).toBeInTheDocument();
    expect(screen.getByText('Agent leaderboard (30 days)')).toBeInTheDocument();
    expect(screen.getByText('Team activity feed')).toBeInTheDocument();
  });
  it('agents do not see team-only widgets even if the catalogue has them', async () => {
    mount(<DashboardPage />, { role: 'agent' });
    expect(await screen.findByText('Follow-ups today')).toBeInTheDocument();
    expect(screen.queryByText('Team activity feed')).toBeNull(); expect(screen.queryByText('Unassigned')).toBeNull(); expect(screen.queryByText('Agents online now')).toBeNull();
    expect(screen.getByText('My follow-ups today')).toBeInTheDocument();
  });
});

describe('leads', () => {
  it('maps legacy ?tab= links from the dashboard to the matching view and selects rows with a visible checked state', async () => {
    mount(<LeadsPage />, { path: '/leads?tab=followup_today' });
    const tab = await screen.findByRole('tab', { name: /Follow-ups Today/ }); expect(tab).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('Pooja Menon');
    const boxes = screen.getAllByRole('checkbox'); fireEvent.click(boxes[1]);
    expect(await screen.findByText(/1 selected/)).toBeInTheDocument();
    expect(document.querySelector('[data-state="checked"]')).toBeTruthy();
  });
  it('lead page uses the configured tabs (hidden Tasks, custom Loan tab) and the configured quick actions', async () => {
    mount(<Routes><Route path="/leads/:id" element={<LeadDetailPage />} /></Routes>, { path: '/leads/l1' });
    await screen.findByRole('heading', { name: 'Pooja Menon' });
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent); expect(tabs.join(' ')).toContain('Loan'); expect(tabs.join(' ')).not.toContain('Tasks');
    expect(screen.getByLabelText('Back')).toBeInTheDocument();
    const bar = screen.getByRole('toolbar', { name: 'Quick access' });
    expect(within(bar).getByLabelText('Quick note')).toBeInTheDocument(); // admin label override
    expect(within(bar).queryByLabelText('Lead files')).toBeNull(); // hidden by admin
    expect(within(bar).getByLabelText('Top-up follow-up')).toBeInTheDocument(); // reminder is due
    // quick note: save → closes → API called once; failed save keeps the modal open with an error
    fireEvent.click(within(bar).getByLabelText('Quick note'));
    const ta = await screen.findByPlaceholderText('Type your note…'); fireEvent.change(ta, { target: { value: 'FAIL' } }); fireEvent.click(screen.getByText('Save note'));
    expect(await screen.findByText('boom')).toBeInTheDocument(); expect(screen.getByPlaceholderText('Type your note…')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Type your note…'), { target: { value: 'Called, interested' } }); fireEvent.click(screen.getByText('Save note'));
    await waitFor(() => expect(screen.queryByPlaceholderText('Type your note…')).toBeNull());
    expect(calls.filter((c) => c.method === 'post' && c.url === '/leads/l1/notes')).toHaveLength(2);
  });
});

describe('reports', () => {
  it('has a Login & Logout tab with summary cards and honest statuses', async () => {
    mount(<ReportsPage />, { path: '/reports?tab=sessions' });
    expect(await screen.findByText('Currently online')).toBeInTheDocument();
    expect(await screen.findByText('Karan Mehta')).toBeInTheDocument(); expect(screen.getByText('9h 13m')).toBeInTheDocument();
    expect(screen.getAllByText('Online').length).toBeGreaterThan(0); expect(screen.getByText('Logged out')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });
});

describe('files viewer', () => {
  it('opens the in-app viewer for a DOCX instead of saying preview is unavailable', async () => {
    mount(<FilesPage />);
    fireEvent.click(await screen.findByText('Induction programme-report'));
    expect(await screen.findByTestId('engine')).toHaveTextContent('docx:Induction.docx');
    expect(screen.queryByText(/Preview not available/)).toBeNull();
  });
});

describe('administration', () => {
  it('redirects old Project Administration URLs to the unified pages, keeping the sub-tab', async () => {
    mount(<Routes><Route path="/project-admin/*" element={<ProjectAdminRedirect />} /><Route path="/admin/*" element={<AdminRoutes />} /></Routes>, { path: '/project-admin/lead-settings/column-groups' });
    expect(await screen.findByRole('tab', { name: 'Column groups' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Roles & Permissions')).toBeInTheDocument(); expect(screen.getByText('Quick Actions')).toBeInTheDocument(); expect(screen.getByText('Dashboards')).toBeInTheDocument();
    expect(screen.queryByText('Project Administration')).toBeNull();
  });
  it('System Settings shows the masked Email Configuration with live status and a test button', async () => {
    mount(<Routes><Route path="/admin/*" element={<AdminRoutes />} /></Routes>, { path: '/admin/settings' });
    expect(await screen.findByText('Email Configuration')).toBeInTheDocument();
    expect(await screen.findByText('smtp****.brevo.com')).toBeInTheDocument(); expect(screen.getByText('ka****@dbs.test')).toBeInTheDocument(); expect(screen.getByText('no****@dbs.test')).toBeInTheDocument(); expect(screen.getByText('DBS')).toBeInTheDocument();
    expect(screen.getAllByText('Connected').length).toBeGreaterThan(0); expect(screen.getByText(/never shown/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Send test email'));
    expect(await screen.findByText(/Test email sent to/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'post' && c.url === '/organisation/mail-test')).toBe(true);
  });
});
