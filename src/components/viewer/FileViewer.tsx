import { lazy, Suspense } from 'react';
import { Download, FileQuestion } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { useFileBlob } from './useFileBlob';

const Engines = lazy(() => import('./engines'));

export type ViewerKind = 'pdf' | 'docx' | 'sheet' | 'csv' | 'pptx' | 'image' | 'text' | 'unsupported';
/** Picks the engine from the MIME type with the extension as fallback. */
export function detectKind(mime: string, fileName: string): ViewerKind {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.includes('wordprocessingml') || ext === 'docx') return 'docx';
  if (mime.includes('presentationml') || ext === 'pptx') return 'pptx';
  if (mime === 'text/csv' || ext === 'csv' || ext === 'tsv') return 'csv';
  if (mime.includes('spreadsheetml') || mime === 'application/vnd.ms-excel' || ['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) return 'sheet';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'image';
  if (mime.startsWith('text/') || ['txt', 'md', 'log', 'json', 'xml'].includes(ext)) return 'text';
  return 'unsupported';
}
export const SUPPORTED_PREVIEW = new Set<ViewerKind>(['pdf', 'docx', 'sheet', 'csv', 'pptx', 'image', 'text']);

/**
 * In-app document viewer. The file is fetched from the authenticated signed stream URL and rendered client-side;
 * nothing is auto-downloaded. The document surface keeps its own light colours so content stays readable in dark mode.
 */
export function FileViewer({ src, mime, fileName, onDownload, canDownload }: { src: string | null; mime: string; fileName: string; onDownload?: () => void; canDownload?: boolean }) {
  const kind = detectKind(mime, fileName);
  const blob = useFileBlob(kind === 'unsupported' ? null : src);
  const download = canDownload ? onDownload : undefined;
  if (kind === 'unsupported') return (
    <div className="h-[60vh] grid place-items-center p-6"><div className="text-center max-w-sm"><FileQuestion size={34} className="mx-auto text-ink-3 mb-3" /><p className="font-medium">Preview isn't supported for this file type.</p><p className="text-[12.5px] text-ink-3 mt-1">{fileName}</p>{download && <Button size="sm" variant="primary" className="mt-3" onClick={download}><Download size={14} /> Download</Button>}</div></div>);
  if (blob.error) return (
    <div className="h-[60vh] grid place-items-center p-6"><div className="text-center max-w-sm"><p className="font-medium">Unable to preview this file.</p><p className="text-[12.5px] text-ink-3 mt-1">{blob.error}</p><div className="flex justify-center gap-2 mt-3"><Button size="sm" onClick={blob.retry}>Try again</Button>{download && <Button size="sm" variant="primary" onClick={download}><Download size={14} /> Download</Button>}</div></div></div>);
  if (!blob.blob) return (
    <div className="h-[60vh] grid place-items-center text-[13px] text-ink-3"><div className="text-center"><Spinner /><p className="mt-3">Loading document…{blob.progress != null && blob.progress > 0 ? ` ${blob.progress}%` : ''}</p>{blob.progress != null && <div className="mt-2 h-1.5 w-48 rounded bg-surface-2 overflow-hidden mx-auto"><div className="h-full bg-primary transition-[width]" style={{ width: `${blob.progress}%` }} /></div>}</div></div>);
  const b = blob.blob;
  return (
    <div className="h-[calc(100dvh-230px)] sm:h-[70vh] min-h-[360px] flex flex-col rounded-md border border-line overflow-hidden bg-surface">
      <Suspense fallback={<div className="flex-1 grid place-items-center text-[13px] text-ink-3"><span className="inline-flex items-center gap-2"><Spinner /> Loading viewer…</span></div>}>
        <Engines kind={kind} blob={b} fileName={fileName} onDownload={download} />
      </Suspense>
    </div>
  );
}

