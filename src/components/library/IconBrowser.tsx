"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Type, Upload } from "lucide-react";
import {
  LIBRARIES,
  type IconRecord,
  type LibraryId,
} from "@/lib/icons/libraries";
import { getLibraryLogo } from "@/lib/icons/library-logos";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import { addRecent } from "@/lib/persistence/db";

const PAGE = 240;

export function IconBrowser() {
  const selectIcon = useProjectStore((s) => s.selectIcon);
  const uploadSvg = useProjectStore((s) => s.uploadSvg);
  const addTextLayer = useProjectStore((s) => s.addTextLayer);
  const clearIconKeepText = useProjectStore((s) => s.clearIconKeepText);
  const selectedId = useProjectStore((s) => s.project.icon?.id);
  const hasIcon = useProjectStore((s) => !!s.project.icon);
  const hasText = useProjectStore((s) =>
    s.project.components.some((c) => c.role === "text"),
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [library, setLibrary] = useState<LibraryId | "all">("ph");
  const [page, setPage] = useState<{
    q: string;
    library: LibraryId | "all";
    icons: IconRecord[];
    hasMore: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFamily, setActiveFamily] = useState<IconRecord | null>(null);
  const [variantId, setVariantId] = useState<string>("regular");
  const menuRef = useRef<HTMLDivElement>(null);

  const icons = page?.q === deferredQuery && page?.library === library
    ? page.icons
    : [];
  const hasMore =
    page?.q === deferredQuery && page?.library === library
      ? page.hasMore
      : false;
  const loading = !(page?.q === deferredQuery && page?.library === library);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  useEffect(() => {
    let active = true;
    const q = deferredQuery;
    const lib = library;
    const params = new URLSearchParams({
      q,
      library: lib,
      limit: String(PAGE),
      offset: "0",
    });
    fetch(`/api/icons/search?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { icons?: IconRecord[]; hasMore?: boolean }) => {
        if (!active) return;
        setActiveFamily(null);
        setPage({
          q,
          library: lib,
          icons: data.icons ?? [],
          hasMore: !!data.hasMore,
        });
      })
      .catch(() => {
        if (!active) return;
        setActiveFamily(null);
        setPage({ q, library: lib, icons: [], hasMore: false });
      });
    return () => {
      active = false;
    };
  }, [deferredQuery, library]);

  const loadMore = () => {
    if (loading || loadingMore) return;
    const params = new URLSearchParams({
      q: deferredQuery,
      library,
      limit: String(PAGE),
      offset: String(icons.length),
    });
    setLoadingMore(true);
    fetch(`/api/icons/search?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { icons?: IconRecord[]; hasMore?: boolean }) => {
        const next = data.icons ?? [];
        setPage((prev) => {
          if (!prev || prev.q !== deferredQuery || prev.library !== library) {
            return prev;
          }
          const seen = new Set(prev.icons.map((i) => i.id));
          return {
            ...prev,
            icons: [...prev.icons, ...next.filter((i) => !seen.has(i.id))],
            hasMore: !!data.hasMore && next.length > 0,
          };
        });
      })
      .finally(() => setLoadingMore(false));
  };

  const previewSvg = useMemo(() => {
    if (!activeFamily) return null;
    const v =
      activeFamily.variants.find((x) => x.id === variantId) ??
      activeFamily.variants[0];
    return v?.svg ?? activeFamily.svg;
  }, [activeFamily, variantId]);

  const onSelectFamily = (icon: IconRecord) => {
    setActiveFamily(icon);
    setVariantId(icon.defaultVariant);
    const v =
      icon.variants.find((x) => x.id === icon.defaultVariant) ??
      icon.variants[0];
    void commitSelection(icon, v?.id ?? icon.defaultVariant, v?.svg ?? icon.svg);
  };

  const commitSelection = async (
    icon: IconRecord,
    nextVariant: string,
    svg: string,
  ) => {
    selectIcon({
      id: `${icon.id}:${nextVariant}`,
      name: icon.name,
      library: icon.library,
      svg,
      keywords: icon.keywords,
    });
    await addRecent({
      iconId: `${icon.id}:${nextVariant}`,
      svg,
      name: icon.name,
      library: icon.library,
    });
  };

  const onVariantChange = (next: string) => {
    if (!activeFamily) return;
    setVariantId(next);
    const v = activeFamily.variants.find((x) => x.id === next);
    if (!v) return;
    void commitSelection(activeFamily, next, v.svg);
  };

  const activeLabel =
    library === "all"
      ? "All libraries"
      : LIBRARIES.find((l) => l.id === library)?.name ?? "Library";

  const showVariantBar =
    !!activeFamily && activeFamily.variants.length > 1;

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="space-y-2 border-b border-[var(--border)] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              library === "all"
                ? "Search icons…"
                : `Search ${activeLabel}…`
            }
            className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent)] focus:bg-white"
          />
        </div>
        <div className="flex gap-1.5">
          <div className="relative min-w-0 flex-1" ref={menuRef}>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-2 text-left text-xs text-[var(--text)] outline-none hover:bg-[var(--bg)]"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <LibraryMark svg={getLibraryLogo(library)} />
              <span className="min-w-0 flex-1 truncate">{activeLabel}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)] transition-transform duration-150",
                  menuOpen && "rotate-180",
                )}
              />
            </button>
            {menuOpen && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
              >
                <LibraryOption
                  label="All libraries"
                  svg={getLibraryLogo("all")}
                  active={library === "all"}
                  onSelect={() => {
                    setLibrary("all");
                    setMenuOpen(false);
                  }}
                />
                {LIBRARIES.map((l) => (
                  <LibraryOption
                    key={l.id}
                    label={l.name}
                    svg={getLibraryLogo(l.id)}
                    active={library === l.id}
                    onSelect={() => {
                      setLibrary(l.id);
                      setMenuOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg)] hover:text-[var(--text)]">
            <input
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then((text) =>
                  uploadSvg(text, f.name.replace(/\.svg$/i, "")),
                );
              }}
            />
            <Upload className="h-3.5 w-3.5" />
            Upload
          </label>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => addTextLayer("Label")}
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-white text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--bg)]"
          >
            <Type className="h-3.5 w-3.5" />
            Add text
          </button>
          {hasIcon && hasText && (
            <button
              type="button"
              onClick={() => clearIconKeepText()}
              className="h-8 shrink-0 rounded-lg border border-[var(--border)] px-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg)] hover:text-[var(--text)]"
              title="Remove icon, keep text"
            >
              Icon off
            </button>
          )}
        </div>
        {showVariantBar && (
          <div className="flex flex-wrap gap-1" data-testid="icon-variant-bar">
            {activeFamily!.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onVariantChange(v.id)}
                className={cn(
                  "h-7 rounded-md px-2 text-[11px] font-medium transition-colors",
                  variantId === v.id
                    ? "bg-[#0f9f8a]/15 text-[#0b7f6e]"
                    : "bg-black/[0.04] text-[var(--text-secondary)] hover:text-[var(--text)]",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-0.5">
          {icons.map((icon) => {
            const selected =
              selectedId === icon.id ||
              selectedId?.startsWith(`${icon.id}:`) ||
              activeFamily?.id === icon.id;
            return (
              <button
                key={icon.id}
                title={
                  library === "all"
                    ? `${icon.name} · ${icon.libraryName}`
                    : icon.name
                }
                onClick={() => onSelectFamily(icon)}
                data-testid={`icon-card-${icon.id}`}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-lg transition-colors",
                  selected
                    ? "bg-[#0f9f8a]/15 text-[#0b7f6e]"
                    : "text-[var(--text)] hover:bg-black/[0.04]",
                )}
              >
                <span
                  className="flex h-[20px] w-[20px] items-center justify-center text-current [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{
                    __html:
                      activeFamily?.id === icon.id && previewSvg
                        ? previewSvg
                        : icon.svg,
                  }}
                />
                {library === "all" && (
                  <span className="mt-0.5 max-w-full truncate px-0.5 text-[8px] leading-none text-[var(--text-secondary)]">
                    {icon.library}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!icons.length && !loading && (
          <p className="p-6 text-center text-xs text-[var(--text-secondary)]">
            No icons found
          </p>
        )}
        {hasMore && (
          <button
            type="button"
            disabled={loading || loadingMore}
            onClick={loadMore}
            className="mt-2 h-8 w-full rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-black/[0.03] disabled:opacity-50"
          >
            {loading || loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}

function LibraryMark({ svg }: { svg?: string }) {
  if (!svg) {
    return (
      <span className="h-3.5 w-3.5 shrink-0 rounded-sm bg-black/[0.08]" />
    );
  }
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 text-[var(--text)] [&_svg]:h-full [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function LibraryOption({
  label,
  svg,
  active,
  onSelect,
}: {
  label: string;
  svg?: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={active}
        className={cn(
          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs",
          active
            ? "bg-[#0f9f8a]/10 text-[#0b7f6e]"
            : "text-[var(--text)] hover:bg-black/[0.03]",
        )}
        onClick={onSelect}
      >
        <LibraryMark svg={svg} />
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}
