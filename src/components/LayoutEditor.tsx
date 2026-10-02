import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, RotateCcw, Save } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { LayoutItem } from '@/lib/uiconfig';

/**
 * Generic admin editor for ordered, toggleable layouts (lead tabs, dashboard widgets, quick actions).
 * Pure UI: the parent owns the list and persistence.
 */
export function LayoutEditor<T extends LayoutItem>({ items, onChange, catalogue, onSave, onReset, saving, renderExtra, allowRename = true }: { items: T[]; onChange: (items: T[]) => void; catalogue: { key: string; label: string; hint?: string; perm?: string }[]; onSave: () => void; onReset?: () => void; saving?: boolean; renderExtra?: (item: T, update: (p: Partial<T>) => void) => React.ReactNode; allowRename?: boolean }) {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const update = (key: string, p: Partial<T>) => onChange(items.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const move = (idx: number, d: -1 | 1) => { const j = idx + d; if (j < 0 || j >= sorted.length) return; const n = [...sorted]; [n[idx], n[j]] = [n[j], n[idx]]; onChange(n.map((i, k) => ({ ...i, order: k }))); };
  return (
    <div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px]"><thead><tr><th className="th w-24">Order</th><th className="th">Item</th>{allowRename && <th className="th">Display name</th>}{renderExtra && <th className="th">Options</th>}<th className="th w-28">Shown</th></tr></thead>
          <tbody>{sorted.map((it, i) => { const c = catalogue.find((x) => x.key === it.key); return (
            <tr key={it.key} className={cn(!it.visible && 'opacity-60')}>
              <td className="td"><span className="inline-flex items-center gap-0.5"><GripVertical size={13} className="text-ink-3" /><button className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-2 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={13} /></button><button className="p-1 rounded text-ink-3 hover:text-ink hover:bg-surface-2 disabled:opacity-30" disabled={i === sorted.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={13} /></button></span></td>
              <td className="td"><span className="font-medium">{c?.label ?? it.key}</span>{c?.hint && <span className="block text-[12px] text-ink-3">{c.hint}</span>}</td>
              {allowRename && <td className="td"><Input sm value={it.label ?? ''} placeholder={c?.label ?? ''} onChange={(e) => update(it.key, { label: e.target.value } as Partial<T>)} className="max-w-[220px]" /></td>}
              {renderExtra && <td className="td">{renderExtra(it, (p) => update(it.key, p))}</td>}
              <td className="td"><button type="button" className="inline-flex items-center gap-1.5 text-[13px] touch-target" onClick={() => update(it.key, { visible: !it.visible } as Partial<T>)}>{it.visible ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-ink-3" />} {it.visible ? 'Shown' : 'Hidden'}</button></td>
            </tr>); })}</tbody></table>
      </div>
      <div className="flex flex-wrap justify-end gap-2 mt-3">{onReset && <Button onClick={onReset}><RotateCcw size={14} /> Reset to default</Button>}<Button variant="primary" loading={saving} onClick={onSave}><Save size={14} /> Save</Button></div>
    </div>
  );
}
