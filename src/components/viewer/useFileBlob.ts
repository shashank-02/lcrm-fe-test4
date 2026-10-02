import { useEffect, useRef, useState } from 'react';

export interface BlobState { blob: Blob | null; loading: boolean; progress: number | null; error: string | null; retry: () => void }

/**
 * Fetches the file through the application's signed, authenticated stream URL exactly once per open,
 * reporting download progress when the server sends Content-Length. Nothing is auto-downloaded to disk.
 */
export function useFileBlob(src: string | null): BlobState {
  const [state, setState] = useState<Omit<BlobState, 'retry'>>({ blob: null, loading: !!src, progress: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!src) { setState({ blob: null, loading: false, progress: null, error: null }); return; }
    abort.current?.abort();
    const ac = new AbortController(); abort.current = ac;
    setState({ blob: null, loading: true, progress: null, error: null });
    (async () => {
      try {
        const res = await fetch(src, { signal: ac.signal, credentials: 'omit' });
        if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'You are not allowed to view this file.' : `The server returned ${res.status}.`);
        const total = Number(res.headers.get('content-length') || 0);
        const type = res.headers.get('content-type') || 'application/octet-stream';
        if (!res.body || !total) { const blob = await res.blob(); if (!ac.signal.aborted) setState({ blob: new Blob([blob], { type }), loading: false, progress: 100, error: null }); return; }
        const reader = res.body.getReader(); const chunks: Uint8Array[] = []; let got = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; if (value) { chunks.push(value); got += value.length; setState((s) => ({ ...s, progress: Math.min(99, Math.round((got / total) * 100)) })); } }
        if (!ac.signal.aborted) setState({ blob: new Blob(chunks as BlobPart[], { type }), loading: false, progress: 100, error: null });
      } catch (err) {
        if (ac.signal.aborted) return;
        setState({ blob: null, loading: false, progress: null, error: err instanceof Error ? err.message : 'Download failed' });
      }
    })();
    return () => ac.abort();
  }, [src, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
