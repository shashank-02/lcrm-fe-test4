import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minus, Plus, Scan } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

/* ---------- shared toolbar pieces ---------- */
export function Toolbar({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border-b border-line bg-surface-2/60 text-[12.5px] min-h-[40px]">{children}{right && <div className="ml-auto flex items-center gap-1.5">{right}</div>}</div>;
}
export function ZoomControls({ zoom, setZoom, onFit, min = 0.5, max = 3 }: { zoom: number; setZoom: (z: number) => void; onFit?: () => void; min?: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Zoom out" onClick={() => setZoom(Math.max(min, Math.round((zoom - 0.1) * 10) / 10))}><Minus size={14} /></Button>
      <button className="w-12 tabular-nums text-center hover:text-primary" title="Reset to 100%" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Zoom in" onClick={() => setZoom(Math.min(max, Math.round((zoom + 0.1) * 10) / 10))}><Plus size={14} /></Button>
      {onFit && <Button size="icon" variant="ghost" className="h-7 w-7" title="Fit to width" onClick={onFit}><Scan size={14} /></Button>}
    </span>
  );
}
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);
  return (
    <span className="inline-flex items-center gap-1">
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Previous" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft size={14} /></Button>
      <input value={draft} onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))} onBlur={() => { const n = Number(draft); if (n >= 1 && n <= total) onPage(n); else setDraft(String(page)); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} className="input input-sm w-12 text-center tabular-nums px-1" aria-label="Page" />
      <span className="text-ink-3 tabular-nums">/ {total}</span>
      <Button size="icon" variant="ghost" className="h-7 w-7" title="Next" disabled={page >= total} onClick={() => onPage(page + 1)}><ChevronRight size={14} /></Button>
    </span>
  );
}
const Loading = ({ label = 'Loading document…' }: { label?: string }) => <div className="h-full min-h-[320px] grid place-items-center text-[13px] text-ink-3"><span className="inline-flex items-center gap-2"><Spinner /> {label}</span></div>;
export function RenderError({ message, onRetry, onDownload }: { message: string; onRetry?: () => void; onDownload?: () => void }) {
  return <div className="h-full min-h-[320px] grid place-items-center p-6"><div className="text-center"><p className="font-medium">Unable to preview this file.</p><p className="text-[12.5px] text-ink-3 mt-1 max-w-sm">{message}</p><div className="flex justify-center gap-2 mt-3">{onRetry && <Button size="sm" onClick={onRetry}>Try again</Button>}{onDownload && <Button size="sm" variant="primary" onClick={onDownload}>Download</Button>}</div></div></div>;
}
const useContainerWidth = (ref: React.RefObject<HTMLElement>) => {
  const [w, setW] = useState(0);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver((e) => setW(e[0].contentRect.width)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, [ref]);
  return w;
};

/* ---------- PDF (pdf.js) ---------- */
export function PdfEngine({ blob, onDownload }: { blob: Blob; onDownload?: () => void }) {
  const host = useRef<HTMLDivElement>(null); const width = useContainerWidth(host);
  const [doc, setDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null); const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1); const [zoom, setZoom] = useState(1); const [fit, setFit] = useState(true);
  const [pageW, setPageW] = useState(612);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
        const data = new Uint8Array(await blob.arrayBuffer());
        const d = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        if (cancelled) return;
        const p1 = await d.getPage(1); setPageW(p1.getViewport({ scale: 1 }).width);
        setDoc(d);
      } catch (e) { if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not parse the PDF'); }
    })();
    return () => { cancelled = true; };
  }, [blob]);
  const scale = fit && width ? Math.max(0.3, (width - 32) / pageW) : zoom;
  if (err) return <RenderError message={err} onDownload={onDownload} />;
  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar right={<><ZoomControls zoom={fit ? Math.round(scale * 100) / 100 : zoom} setZoom={(z) => { setFit(false); setZoom(z); }} onFit={() => setFit(true)} /><Button size="icon" variant="ghost" className="h-7 w-7" title="Open in new tab" onClick={() => { const u = URL.createObjectURL(blob); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 60_000); }}><ExternalLink size={14} /></Button></>}>{doc && <Pager page={page} total={doc.numPages} onPage={(p) => { setPage(p); document.getElementById(`pdf-page-${p}`)?.scrollIntoView({ block: 'start' }); }} />}</Toolbar>
      <div ref={host} className="flex-1 min-h-0 overflow-auto scroll-thin bg-[#525659] p-4 space-y-4" onScroll={(e) => { const el = e.currentTarget; const pages = Array.from(el.querySelectorAll<HTMLElement>('[data-pdf-page]')); const cur = pages.find((p) => p.offsetTop + p.offsetHeight - el.scrollTop > el.clientHeight * 0.4); if (cur) { const n = Number(cur.dataset.pdfPage); if (n !== page) setPage(n); } }}>
        {!doc ? <Loading /> : Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i + 1} doc={doc} num={i + 1} scale={scale} active={Math.abs(i + 1 - page) <= 2} />)}
      </div>
    </div>
  );
}
function PdfPage({ doc, num, scale, active }: { doc: import('pdfjs-dist').PDFDocumentProxy; num: number; scale: number; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null); const [size, setSize] = useState<{ w: number; h: number } | null>(null); const [rendered, setRendered] = useState(false);
  useEffect(() => {
    let cancelled = false; let task: { cancel: () => void } | null = null;
    (async () => {
      const p = await doc.getPage(num); const vp = p.getViewport({ scale });
      if (cancelled) return;
      setSize({ w: vp.width, h: vp.height });
      if (!active || !canvas.current) return;
      const c = canvas.current; const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr); c.style.width = `${vp.width}px`; c.style.height = `${vp.height}px`;
      const ctx = c.getContext('2d'); if (!ctx) return;
      const t = p.render({ canvasContext: ctx, viewport: p.getViewport({ scale: scale * dpr }) }); task = t;
      try { await t.promise; if (!cancelled) setRendered(true); } catch { /* cancelled */ }
    })();
    return () => { cancelled = true; task?.cancel(); };
  }, [doc, num, scale, active]);
  return (
    <div id={`pdf-page-${num}`} data-pdf-page={num} className="mx-auto bg-white shadow-pop relative" style={{ width: size?.w ?? 'auto', height: size?.h ?? 400 }}>
      <canvas ref={canvas} className={cn('block', !rendered && 'opacity-0')} />
      {!rendered && <span className="absolute inset-0 grid place-items-center text-[12px] text-ink-3">Page {num}</span>}
    </div>
  );
}

/* ---------- DOCX (docx-preview) ---------- */
export function DocxEngine({ blob, onDownload }: { blob: Blob; onDownload?: () => void }) {
  const host = useRef<HTMLDivElement>(null); const styles = useRef<HTMLDivElement>(null); const outer = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading'); const [err, setErr] = useState(''); const [zoom, setZoom] = useState(1); const [pages, setPages] = useState(0);
  const width = useContainerWidth(outer);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { renderAsync } = await import('docx-preview');
        if (!host.current || !styles.current) return;
        host.current.innerHTML = ''; styles.current.innerHTML = '';
        await renderAsync(blob, host.current, styles.current, { className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, renderEndnotes: true, ignoreFonts: false, useBase64URL: true, trimXmlDeclaration: true, experimental: true } as never);
        if (cancelled) return;
        setPages(host.current.querySelectorAll('section.docx').length);
        setState('ok');
      } catch (e) { if (!cancelled) { setErr(e instanceof Error ? e.message : 'Could not render this Word document'); setState('error'); } }
    })();
    return () => { cancelled = true; };
  }, [blob]);
  const fitZoom = () => { const page = host.current?.querySelector<HTMLElement>('section.docx'); if (page && width) setZoom(Math.min(1.5, Math.max(0.4, Math.round(((width - 32) / page.offsetWidth) * 100) / 100))); };
  useEffect(() => { if (state === 'ok' && width && width < 700) fitZoom(); }, [state, width]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === 'error') return <RenderError message={err} onDownload={onDownload} />;
  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar right={<ZoomControls zoom={zoom} setZoom={setZoom} onFit={fitZoom} />}>{pages > 0 && <span className="text-ink-3">{pages} page{pages > 1 ? 's' : ''}</span>}</Toolbar>
      <div ref={outer} className="flex-1 min-h-0 overflow-auto scroll-thin bg-[#525659] p-4">
        {state === 'loading' && <Loading />}
        <div ref={styles} />
        <div ref={host} className={cn('docx-host origin-top-left', state !== 'ok' && 'hidden')} style={{ zoom }} />
      </div>
    </div>
  );
}

/* ---------- XLSX / XLS / CSV (SheetJS) ---------- */
export function SheetEngine({ blob, isCsv, onDownload }: { blob: Blob; isCsv?: boolean; onDownload?: () => void }) {
  const [sheets, setSheets] = useState<{ name: string; html: string; rows: number }[] | null>(null); const [err, setErr] = useState(''); const [active, setActive] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const XLSX = await import('xlsx');
        const wb = isCsv ? XLSX.read(await blob.text(), { type: 'string', raw: true }) : XLSX.read(new Uint8Array(await blob.arrayBuffer()), { type: 'array', cellStyles: false, cellDates: true });
        if (cancelled) return;
        const out = wb.SheetNames.map((name) => { const ws = wb.Sheets[name]; const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null; const rows = range ? range.e.r - range.s.r + 1 : 0; return { name, rows, html: XLSX.utils.sheet_to_html(ws, { id: `sheet-${name}`, editable: false }) }; });
        setSheets(out);
      } catch (e) { if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not read the spreadsheet'); }
    })();
    return () => { cancelled = true; };
  }, [blob, isCsv]);
  if (err) return <RenderError message={err} onDownload={onDownload} />;
  if (!sheets) return <Loading label="Loading spreadsheet…" />;
  const sheet = sheets[active];
  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar right={<span className="text-ink-3 tabular-nums">{sheet.rows.toLocaleString()} rows</span>}>
        <div className="flex gap-1 overflow-x-auto scroll-hidden">{sheets.map((s, i) => <button key={s.name} onClick={() => setActive(i)} className={cn('px-2.5 h-7 rounded-md whitespace-nowrap', i === active ? 'bg-primary text-white' : 'hover:bg-surface-2 text-ink-2')}>{s.name}</button>)}</div>
      </Toolbar>
      <div className="flex-1 min-h-0 overflow-auto scroll-thin bg-surface sheet-host" dangerouslySetInnerHTML={{ __html: sheet.html }} />
    </div>
  );
}

/* ---------- PPTX (lightweight OOXML renderer) ---------- */
interface Shape { kind: 'text' | 'image' | 'shape'; x: number; y: number; w: number; h: number; paras?: Para[]; src?: string; fill?: string; line?: string; shapeType?: string; positioned: boolean }
interface Para { align?: string; bullet?: string; level: number; runs: { text: string; bold?: boolean; italic?: boolean; underline?: boolean; size?: number; color?: string; font?: string }[] }
interface Slide { num: number; w: number; h: number; bg?: string; shapes: Shape[]; notes?: string }
const EMU = 12700; // EMU per point
type Node_ = Element | Document | null | undefined;
const q = (el: Node_, sel: string) => el?.querySelector(sel) ?? null;
const qa = (el: Node_, sel: string) => (el ? Array.from(el.querySelectorAll(sel)) : []);
const color = (fill: Element | null) => { const c = q(fill, 'srgbClr'); if (c) return `#${c.getAttribute('val')}`; const sc = q(fill, 'schemeClr'); if (sc) { const v = sc.getAttribute('val') ?? ''; return ({ tx1: '#111111', tx2: '#333333', bg1: '#FFFFFF', bg2: '#F3F3F3', accent1: '#4472C4', accent2: '#ED7D31', accent3: '#A5A5A5', accent4: '#FFC000', accent5: '#5B9BD5', accent6: '#70AD47', dk1: '#000000', dk2: '#1F3864', lt1: '#FFFFFF', lt2: '#E7E6E6' } as Record<string, string>)[v]; } return undefined; };
function parseParas(txBody: Element | null): Para[] {
  return qa(txBody, 'p').map((p) => {
    const pPr = q(p, 'pPr'); const level = Number(pPr?.getAttribute('lvl') ?? 0); const align = pPr?.getAttribute('algn') ?? undefined;
    const bullet = q(pPr, 'buNone') ? undefined : q(pPr, 'buChar')?.getAttribute('char') ?? (q(pPr, 'buAutoNum') ? '1.' : undefined);
    const runs = Array.from(p.children).filter((c) => c.localName === 'r' || c.localName === 'br' || c.localName === 'fld').map((r) => {
      if (r.localName === 'br') return { text: '\n' };
      const rPr = q(r, 'rPr'); const sz = rPr?.getAttribute('sz');
      return { text: q(r, 't')?.textContent ?? '', bold: rPr?.getAttribute('b') === '1', italic: rPr?.getAttribute('i') === '1', underline: !!rPr?.getAttribute('u') && rPr?.getAttribute('u') !== 'none', size: sz ? Number(sz) / 100 : undefined, color: color(q(rPr, 'solidFill')), font: q(rPr, 'latin')?.getAttribute('typeface') ?? undefined };
    });
    return { align, bullet, level, runs };
  });
}
function xfrm(el: Element | null): { x: number; y: number; w: number; h: number } | null {
  const off = q(el, 'xfrm > off'), ext = q(el, 'xfrm > ext'); if (!off || !ext) return null;
  return { x: Number(off.getAttribute('x')) / EMU, y: Number(off.getAttribute('y')) / EMU, w: Number(ext.getAttribute('cx')) / EMU, h: Number(ext.getAttribute('cy')) / EMU };
}
async function parsePptx(blob: Blob): Promise<Slide[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(blob);
  const xml = async (path: string) => { const f = zip.file(path); if (!f) return null; return new DOMParser().parseFromString(await f.async('string'), 'application/xml'); };
  const pres = await xml('ppt/presentation.xml'); if (!pres) throw new Error('Not a valid PowerPoint file');
  const sz = q(pres, 'sldSz'); const W = Number(sz?.getAttribute('cx') ?? 9144000) / EMU, H = Number(sz?.getAttribute('cy') ?? 6858000) / EMU;
  const presRels = await xml('ppt/_rels/presentation.xml.rels');
  const relMap = new Map(qa(presRels, 'Relationship').map((r) => [r.getAttribute('Id')!, r.getAttribute('Target')!]));
  const slidePaths = qa(pres, 'sldId').map((s) => relMap.get(s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? s.getAttribute('r:id') ?? '')).filter(Boolean).map((t) => `ppt/${t!.replace(/^\/?ppt\//, '')}`);
  const media = new Map<string, string>();
  const mediaUrl = async (path: string) => { if (media.has(path)) return media.get(path)!; const f = zip.file(path); if (!f) return ''; const b = await f.async('blob'); const ext = path.split('.').pop()?.toLowerCase(); const url = URL.createObjectURL(new Blob([b], { type: ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'image/jpeg' })); media.set(path, url); return url; };
  // Layout placeholders give positions to shapes that inherit them.
  const layoutXfrm = async (slidePath: string) => {
    const rels = await xml(slidePath.replace(/slides\/(slide\d+\.xml)$/, 'slides/_rels/$1.rels'));
    const lay = qa(rels, 'Relationship').find((r) => r.getAttribute('Type')?.endsWith('/slideLayout'))?.getAttribute('Target');
    const out = new Map<string, { x: number; y: number; w: number; h: number }>();
    if (!lay) return { out, rels };
    const layDoc = await xml(`ppt/${lay.replace(/^\.\.\//, '')}`);
    const master = qa(await xml(`ppt/slideLayouts/_rels/${lay.split('/').pop()}.rels`), 'Relationship').find((r) => r.getAttribute('Type')?.endsWith('/slideMaster'))?.getAttribute('Target');
    const masterDoc = master ? await xml(`ppt/${master.replace(/^\.\.\//, '')}`) : null;
    for (const doc of [masterDoc, layDoc]) qa(doc, 'sp').forEach((sp) => { const ph = q(sp, 'nvPr > ph'); const pos = xfrm(q(sp, 'spPr')); if (ph && pos) { out.set(`type:${ph.getAttribute('type') ?? 'body'}`, pos); if (ph.getAttribute('idx')) out.set(`idx:${ph.getAttribute('idx')}`, pos); } });
    return { out, rels };
  };
  const slides: Slide[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const path = slidePaths[i]; const doc = await xml(path); if (!doc) continue;
    const { out: inherited, rels } = await layoutXfrm(path);
    const relTargets = new Map(qa(rels, 'Relationship').map((r) => [r.getAttribute('Id')!, r.getAttribute('Target')!]));
    const bg = color(q(doc, 'bg > bgPr > solidFill')) ?? undefined;
    const shapes: Shape[] = [];
    const walk = async (parent: Element, dx = 0, dy = 0) => {
      for (const el of Array.from(parent.children)) {
        if (el.localName === 'grpSp') { const g = xfrm(q(el, 'grpSpPr')); const chOff = q(el, 'grpSpPr > xfrm > chOff'); const cx = chOff ? Number(chOff.getAttribute('x')) / EMU : 0, cy = chOff ? Number(chOff.getAttribute('y')) / EMU : 0; await walk(el, dx + (g ? g.x - cx : 0), dy + (g ? g.y - cy : 0)); continue; }
        if (el.localName === 'sp') {
          const ph = q(el, 'nvPr > ph'); let pos = xfrm(q(el, 'spPr'));
          if (!pos && ph) pos = inherited.get(`idx:${ph.getAttribute('idx')}`) ?? inherited.get(`type:${ph.getAttribute('type') ?? 'body'}`) ?? null;
          const paras = parseParas(q(el, 'txBody')); const fill = color(q(el, 'spPr > solidFill')); const line = color(q(el, 'spPr > ln > solidFill'));
          const hasText = paras.some((p) => p.runs.some((r) => r.text.trim()));
          if (!hasText && !fill && !line) continue;
          shapes.push({ kind: hasText ? 'text' : 'shape', x: (pos?.x ?? 0) + dx, y: (pos?.y ?? 0) + dy, w: pos?.w ?? W - 72, h: pos?.h ?? 40, paras, fill, line, shapeType: q(el, 'prstGeom')?.getAttribute('prst') ?? undefined, positioned: !!pos });
        }
        if (el.localName === 'pic') {
          const pos = xfrm(q(el, 'spPr')); const embed = q(el, 'blip')?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed') ?? q(el, 'blip')?.getAttribute('r:embed');
          const target = embed ? relTargets.get(embed) : undefined; if (!pos || !target) continue;
          shapes.push({ kind: 'image', x: pos.x + dx, y: pos.y + dy, w: pos.w, h: pos.h, src: await mediaUrl(`ppt/${target.replace(/^\.\.\//, '')}`), positioned: true });
        }
        if (el.localName === 'graphicFrame') { const pos = xfrm(el); const tbl = q(el, 'tbl'); if (pos && tbl) { const rows = qa(tbl, 'tr').map((tr) => qa(tr, 'tc').map((tc) => qa(tc, 't').map((t) => t.textContent).join(' ')).join(' | ')); shapes.push({ kind: 'text', x: pos.x + dx, y: pos.y + dy, w: pos.w, h: pos.h, paras: rows.map((r) => ({ level: 0, runs: [{ text: r, size: 11 }] })), fill: '#FFFFFF', line: '#CCCCCC', positioned: true }); } }
      }
    };
    const tree = q(doc, 'cSld > spTree'); if (tree) await walk(tree);
    slides.push({ num: i + 1, w: W, h: H, bg, shapes });
  }
  return slides;
}
export function PptxEngine({ blob, onDownload }: { blob: Blob; onDownload?: () => void }) {
  const outer = useRef<HTMLDivElement>(null); const width = useContainerWidth(outer);
  const [slides, setSlides] = useState<Slide[] | null>(null); const [err, setErr] = useState(''); const [cur, setCur] = useState(1); const [zoom, setZoom] = useState(1); const [fit, setFit] = useState(true);
  useEffect(() => { let c = false; parsePptx(blob).then((s) => { if (!c) setSlides(s); }).catch((e) => { if (!c) setErr(e instanceof Error ? e.message : 'Could not read the presentation'); }); return () => { c = true; }; }, [blob]);
  if (err) return <RenderError message={err} onDownload={onDownload} />;
  if (!slides) return <Loading label="Loading presentation…" />;
  if (!slides.length) return <RenderError message="This presentation has no slides." onDownload={onDownload} />;
  const W = slides[0].w; const scale = fit && width ? Math.max(0.2, (width - 32) / W) : zoom;
  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar right={<ZoomControls zoom={fit ? Math.round(scale * 100) / 100 : zoom} setZoom={(z) => { setFit(false); setZoom(z); }} onFit={() => setFit(true)} min={0.2} max={2} />}><Pager page={cur} total={slides.length} onPage={(p) => { setCur(p); document.getElementById(`pptx-slide-${p}`)?.scrollIntoView({ block: 'start' }); }} /></Toolbar>
      <div ref={outer} className="flex-1 min-h-0 overflow-auto scroll-thin bg-[#525659] p-4 space-y-4" onScroll={(e) => { const el = e.currentTarget; const items = Array.from(el.querySelectorAll<HTMLElement>('[data-slide]')); const c = items.find((p) => p.offsetTop + p.offsetHeight - el.scrollTop > el.clientHeight * 0.4); if (c) { const n = Number(c.dataset.slide); if (n !== cur) setCur(n); } }}>
        {slides.map((s) => <SlideView key={s.num} slide={s} scale={scale} />)}
      </div>
    </div>
  );
}
function SlideView({ slide, scale }: { slide: Slide; scale: number }) {
  const positioned = slide.shapes.filter((s) => s.positioned), flow = slide.shapes.filter((s) => !s.positioned);
  return (
    <div id={`pptx-slide-${slide.num}`} data-slide={slide.num} className="mx-auto shadow-pop relative overflow-hidden bg-white" style={{ width: slide.w * scale, height: slide.h * scale, background: slide.bg ?? '#FFFFFF' }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: slide.w, height: slide.h, transform: `scale(${scale})` }}>
        {positioned.map((s, i) => <ShapeView key={i} s={s} />)}
        {flow.length > 0 && <div className="absolute left-[36px] right-[36px] top-[36px] flex flex-col gap-2">{flow.map((s, i) => <ShapeView key={i} s={s} inline />)}</div>}
      </div>
      <span className="absolute bottom-1 right-2 text-[10px] text-black/40">{slide.num}</span>
    </div>
  );
}
function ShapeView({ s, inline }: { s: Shape; inline?: boolean }) {
  const style: React.CSSProperties = inline ? { position: 'relative', width: '100%' } : { position: 'absolute', left: s.x, top: s.y, width: s.w, height: s.h };
  if (s.kind === 'image') return <img src={s.src} alt="" style={{ ...style, objectFit: 'contain' }} draggable={false} />;
  const radius = s.shapeType === 'ellipse' ? '50%' : s.shapeType === 'roundRect' ? 8 : 0;
  return (
    <div style={{ ...style, background: s.fill, border: s.line ? `1px solid ${s.line}` : undefined, borderRadius: radius, padding: '4pt 6pt', overflow: 'hidden', color: '#111', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 18, lineHeight: 1.25 }}>
      {s.paras?.map((p, i) => (
        <div key={i} style={{ textAlign: ({ ctr: 'center', r: 'right', just: 'justify' } as Record<string, React.CSSProperties['textAlign']>)[p.align ?? ''] ?? 'left', paddingLeft: p.level * 18, display: 'flex', gap: 6 }}>
          {p.bullet && <span style={{ flex: 'none' }}>{p.bullet === '1.' ? `${i + 1}.` : p.bullet}</span>}
          <span style={{ whiteSpace: 'pre-wrap', minHeight: '1em' }}>{p.runs.map((r, j) => <span key={j} style={{ fontWeight: r.bold ? 700 : undefined, fontStyle: r.italic ? 'italic' : undefined, textDecoration: r.underline ? 'underline' : undefined, fontSize: r.size ? `${r.size}pt` : undefined, color: r.color, fontFamily: r.font }}>{r.text}</span>)}</span>
        </div>))}
    </div>
  );
}

/* ---------- Images ---------- */
/** Blob → ArrayBuffer with a FileReader fallback for environments whose Blob lacks arrayBuffer(). */
export const toArrayBuffer = (b: Blob): Promise<ArrayBuffer> => (typeof b.arrayBuffer === 'function' ? b.arrayBuffer() : new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.onerror = () => rej(r.error); r.readAsArrayBuffer(b); }));
/** Detects the real image type from the first bytes when the server sent a generic/incorrect Content-Type. */
export async function sniffImageType(blob: Blob): Promise<string | null> {
  const b = new Uint8Array(await toArrayBuffer(blob.slice(0, 12)));
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp';
  return null;
}

/**
 * Image preview. The object URL is created and revoked inside one effect so React StrictMode's mount → unmount →
 * mount cycle can never leave the <img> pointing at a revoked URL (the cause of the "broken image" report).
 */
export function ImageEngine({ blob, name, onDownload }: { blob: Blob; name: string; onDownload?: () => void }) {
  const [url, setUrl] = useState<string | null>(null); const [failed, setFailed] = useState(false); const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = useState<'fit' | 'full' | 'zoom'>('fit'); const [zoom, setZoom] = useState(1);
  useEffect(() => {
    let revoked = false; let objectUrl = '';
    (async () => {
      const type = blob.type.startsWith('image/') ? blob.type : (await sniffImageType(blob)) ?? blob.type;
      const typed = type && type !== blob.type ? new Blob([blob], { type }) : blob;
      if (revoked) return;
      objectUrl = URL.createObjectURL(typed); setUrl(objectUrl); setFailed(false);
    })();
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); setUrl(null); };
  }, [blob]);
  if (failed) return <RenderError message="The file could not be decoded as an image. It may be corrupted or saved with the wrong extension." onDownload={onDownload} />;
  return (
    <div className="flex flex-col h-full min-h-0">
      <Toolbar right={<><Button size="sm" variant={mode === 'fit' ? 'primary' : 'ghost'} className="h-7" onClick={() => setMode('fit')}><Scan size={13} /> Fit</Button><Button size="sm" variant={mode === 'full' ? 'primary' : 'ghost'} className="h-7" onClick={() => setMode('full')}><Maximize2 size={13} /> Full size</Button><ZoomControls zoom={mode === 'zoom' ? zoom : 1} setZoom={(z) => { setMode('zoom'); setZoom(z); }} min={0.25} max={5} /></>}><span className="text-ink-3 truncate min-w-0">{name}{dims && <span className="ml-2 tabular-nums">{dims.w}×{dims.h}</span>}</span></Toolbar>
      <div className="flex-1 min-h-0 overflow-auto scroll-thin bg-[#1f2328] grid place-items-center p-3" onContextMenu={(e) => e.preventDefault()}>
        {!url ? <span className="inline-flex items-center gap-2 text-[13px] text-white/70"><Spinner /> Preparing image…</span>
          : <img key={url} src={url} alt={name} draggable={false} onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} onError={() => setFailed(true)} className={cn('select-none', mode === 'fit' && 'max-w-full max-h-full object-contain')} style={mode === 'zoom' ? { transform: `scale(${zoom})`, transformOrigin: 'center', maxWidth: 'none' } : mode === 'full' ? { maxWidth: 'none' } : undefined} />}
      </div>
    </div>
  );
}

/* ---------- Plain text ---------- */
export function TextEngine({ blob }: { blob: Blob }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => { let c = false; blob.text().then((t) => { if (!c) setText(t.length > 2_000_000 ? `${t.slice(0, 2_000_000)}\n\n… (truncated — download for the full file)` : t); }); return () => { c = true; }; }, [blob]);
  if (text === null) return <Loading label="Loading text…" />;
  return <pre className="flex-1 min-h-0 overflow-auto scroll-thin p-4 text-[12.5px] leading-relaxed whitespace-pre-wrap break-words bg-surface font-mono h-full">{text}</pre>;
}

/* ---------- dispatcher (lazy entry) ---------- */
export default function EngineSwitch({ kind, blob, fileName, onDownload }: { kind: 'pdf' | 'docx' | 'sheet' | 'csv' | 'pptx' | 'image' | 'text'; blob: Blob; fileName: string; onDownload?: () => void }) {
  switch (kind) {
    case 'pdf': return <PdfEngine blob={blob} onDownload={onDownload} />;
    case 'docx': return <DocxEngine blob={blob} onDownload={onDownload} />;
    case 'sheet': return <SheetEngine blob={blob} onDownload={onDownload} />;
    case 'csv': return <SheetEngine blob={blob} isCsv onDownload={onDownload} />;
    case 'pptx': return <PptxEngine blob={blob} onDownload={onDownload} />;
    case 'image': return <ImageEngine blob={blob} name={fileName} onDownload={onDownload} />;
    default: return <TextEngine blob={blob} />;
  }
}
