import type { LibraryId } from "./libraries";

/**
 * Simplified official brand marks for icon libraries.
 * Static SVGs so the menu never depends on pack icon names.
 */
export const LIBRARY_LOGOS: Record<LibraryId | "all", string> = {
  all: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,

  tabler: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#066FD1"/><path d="M7.5 8.2h3.2c1.7 0 2.8 1 2.8 2.5S12.4 13 10.7 13H9.2v3.3H7.5V8.2zm1.7 3.3h1.3c.7 0 1.15-.4 1.15-1s-.45-1-1.15-1H9.2v2zM14.2 16.5c-.9 0-1.55-.35-1.95-.95l1.25-.85c.2.3.5.5.85.5.45 0 .75-.25.75-.65 0-.9-2.85-.4-2.85-2.55 0-1.15.95-2 2.2-2 .8 0 1.45.3 1.85.85l-1.2.85c-.2-.25-.45-.4-.75-.4-.4 0-.65.2-.65.55 0 .85 2.85.35 2.85 2.55 0 1.25-1 2.1-2.35 2.1z" fill="#fff"/></svg>`,

  lucide: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#F56565"/><path d="M12 6.5l1.2 3.6h3.8l-3 2.2 1.1 3.7-3.1-2.3-3.1 2.3 1.1-3.7-3-2.2h3.8L12 6.5z" fill="#fff"/></svg>`,

  feather: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#FFAC33" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>`,

  heroicons: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#6366F1"/><path d="M8 7.5h3.1c1.85 0 3.05 1.15 3.05 2.85 0 1.2-.65 2.15-1.7 2.55L15.2 16.5h-2.15l-2.35-3.35H9.75V16.5H8V7.5zm1.75 4.35h1.25c.9 0 1.45-.5 1.45-1.25s-.55-1.25-1.45-1.25H9.75v2.5z" fill="#fff"/></svg>`,

  ph: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2.2l8 4.6v10.4l-8 4.6-8-4.6V6.8l8-4.6z" fill="#3D348B"/><path d="M10 8h2.4c1.65 0 2.7 1 2.7 2.45S14.05 13 12.4 13H11.5v3H10V8zm1.5 3.5h.8c.7 0 1.15-.4 1.15-1.05S13 9.4 12.3 9.4h-.8v2.1z" fill="#fff"/></svg>`,

  ri: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#111"/><path d="M7 7h4.2c1.9 0 3.2 1.2 3.2 3s-1.3 3-3.2 3H9.2V17H7V7zm2.2 4.5h1.7c.75 0 1.25-.45 1.25-1.1S11.65 9.3 10.9 9.3H9.2v2.2z" fill="#fff"/></svg>`,

  iconoir: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#000"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="#fff"/></svg>`,

  bi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#7952B3"/><path d="M8 7h3.1c1.7 0 2.9 1 2.9 2.55 0 1.15-.65 1.95-1.7 2.25L14.2 17h-2.3l-1.85-4.4H9.7V17H8V7zm1.7 4.1h1.2c.75 0 1.2-.4 1.2-1.05s-.45-1.05-1.2-1.05H9.7v2.1z" fill="#fff"/></svg>`,

  "material-symbols": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#4285F4"/><path d="M12 7l1.4 4.2H18l-3.5 2.6 1.3 4.2L12 15.4 8.2 18l1.3-4.2L6 11.2h4.6L12 7z" fill="#fff"/></svg>`,
};

export function getLibraryLogo(id: LibraryId | "all"): string {
  return LIBRARY_LOGOS[id];
}
