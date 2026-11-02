import type { LibraryId } from "./libraries";

/**
 * Simplified official brand marks for icon libraries.
 * Static SVGs so the menu never depends on pack icon names.
 */
export const LIBRARY_LOGOS: Record<LibraryId | "all", string> = {
  all: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,

  // Tabler — rounded square with stylized mark (brand blue)
  tabler: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#066FD1"/><path d="M7.5 8.2h3.2c1.7 0 2.8 1 2.8 2.5S12.4 13 10.7 13H9.2v3.3H7.5V8.2zm1.7 3.3h1.3c.7 0 1.15-.4 1.15-1s-.45-1-1.15-1H9.2v2zM14.2 16.5c-.9 0-1.55-.35-1.95-.95l1.25-.85c.2.3.5.5.85.5.45 0 .75-.25.75-.65 0-.9-2.85-.4-2.85-2.55 0-1.15.95-2 2.2-2 .8 0 1.45.3 1.85.85l-1.2.85c-.2-.25-.45-.4-.75-.4-.4 0-.65.2-.65.55 0 .85 2.85.35 2.85 2.55 0 1.25-1 2.1-2.35 2.1z" fill="#fff"/></svg>`,

  // Lucide — orange disc with white spark (brand)
  lucide: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#F56565"/><path d="M12 6.5l1.2 3.6h3.8l-3 2.2 1.1 3.7-3.1-2.3-3.1 2.3 1.1-3.7-3-2.2h3.8L12 6.5z" fill="#fff"/></svg>`,

  // Feather — classic feather quill
  feather: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFAC33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>`,

  // Heroicons — Tailwind-adjacent indigo mark
  heroicons: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#6366F1"/><path d="M8 7.5h3.1c1.85 0 3.05 1.15 3.05 2.85 0 1.2-.65 2.15-1.7 2.55L15.2 16.5h-2.15l-2.35-3.35H9.75V16.5H8V7.5zm1.75 4.35h1.25c.9 0 1.45-.5 1.45-1.25s-.55-1.25-1.45-1.25H9.75v2.5z" fill="#fff"/></svg>`,

  // Phosphor — geometric hexagonal P
  ph: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.2l8 4.6v10.4l-8 4.6-8-4.6V6.8l8-4.6z" fill="#3D348B"/><path d="M10 8h2.4c1.65 0 2.7 1 2.7 2.45S14.05 13 12.4 13H11.5v3H10V8zm1.5 3.5h.8c.7 0 1.15-.4 1.15-1.05S13 9.4 12.3 9.4h-.8v2.1z" fill="#fff"/></svg>`,

  hugeicons: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#111"/><circle cx="8" cy="12" r="2" fill="#fff"/><circle cx="16" cy="12" r="2" fill="#fff"/><circle cx="12" cy="8" r="2" fill="#fff"/><circle cx="12" cy="16" r="2" fill="#fff"/></svg>`,
};

export function getLibraryLogo(id: LibraryId | "all"): string {
  return LIBRARY_LOGOS[id];
}
