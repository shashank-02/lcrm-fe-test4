import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom lacks layout APIs used by charts and the menu clamp.
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() } as unknown as MediaQueryList));
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || vi.fn();
window.scrollTo = vi.fn() as never;
Element.prototype.scrollTo = Element.prototype.scrollTo || vi.fn();
URL.createObjectURL = URL.createObjectURL || (() => 'blob:test');
URL.revokeObjectURL = URL.revokeObjectURL || (() => undefined);
