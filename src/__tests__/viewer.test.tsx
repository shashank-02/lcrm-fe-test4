import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ImageEngine, sniffImageType } from '@/components/viewer/engines';
import { detectKind } from '@/components/viewer/FileViewer';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('image preview', () => {
  const created: string[] = []; const revoked: string[] = [];
  beforeEach(() => { created.length = 0; revoked.length = 0; let n = 0; URL.createObjectURL = vi.fn(() => { const u = `blob:test/${++n}`; created.push(u); return u; }); URL.revokeObjectURL = vi.fn((u: string) => { revoked.push(u); }); });

  it('never leaves the <img> pointing at a revoked object URL under StrictMode double-mounting', async () => {
    const blob = new Blob([PNG], { type: 'image/png' });
    render(<StrictMode><ImageEngine blob={blob} name="Glossy DBS Growth Emblem.png" /></StrictMode>);
    const img = await screen.findByRole('img');
    await waitFor(() => expect(img.getAttribute('src')).toMatch(/^blob:/));
    const src = img.getAttribute('src')!;
    expect(revoked).not.toContain(src);               // the live URL is still valid
    expect(created.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Fit')).toBeInTheDocument(); expect(screen.getByText('Full size')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Full size')); expect(img.style.maxWidth).toBe('none');
  });
  it('sniffs the real image type when the server sent a generic content-type', async () => {
    expect(await sniffImageType(new Blob([PNG], { type: 'application/octet-stream' }))).toBe('image/png');
    expect(await sniffImageType(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])]))).toBe('image/jpeg');
    expect(await sniffImageType(new Blob([new Uint8Array([1, 2, 3, 4])]))).toBeNull();
    render(<ImageEngine blob={new Blob([PNG], { type: 'application/octet-stream' })} name="logo.png" />);
    const img = await screen.findByRole('img');
    await waitFor(() => expect(img.getAttribute('src')).toMatch(/^blob:/));
  });
  it('shows a clear error with Download instead of a broken image when decoding fails', async () => {
    const onDownload = vi.fn();
    render(<ImageEngine blob={new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })} name="bad.png" onDownload={onDownload} />);
    const img = await screen.findByRole('img');
    fireEvent.error(img);
    expect(await screen.findByText(/Unable to preview this file/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Download')); expect(onDownload).toHaveBeenCalled();
  });
  it('routes each upload type to the right engine and flags unsupported ones', () => {
    expect(detectKind('image/png', 'a.png')).toBe('image'); expect(detectKind('application/octet-stream', 'photo.JPG')).toBe('image'); expect(detectKind('image/webp', 'x.webp')).toBe('image');
    expect(detectKind('application/pdf', 'a.pdf')).toBe('pdf'); expect(detectKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.docx')).toBe('docx');
    expect(detectKind('application/vnd.ms-excel', 'a.xls')).toBe('sheet'); expect(detectKind('text/csv', 'a.csv')).toBe('csv'); expect(detectKind('application/octet-stream', 'deck.pptx')).toBe('pptx');
    expect(detectKind('application/zip', 'archive.zip')).toBe('unsupported'); expect(detectKind('application/msword', 'old.doc')).toBe('unsupported');
  });
});
