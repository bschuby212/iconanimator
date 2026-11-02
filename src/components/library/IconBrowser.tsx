"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
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
const VISIBLE_LIBS = LIBRARIES.filter((l) => l.id !== "hugeicons");

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
  const [library, setLibrary] = useState<LibraryId | "all">("tabler");
  const [icons, setIcons] = useState<IconRecord[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    setLoading(true);
    const params = new URLSearchParams({
      q: deferredQuery,
      library,
      limit: String(PAGE),
      offset: "0",
    });
    fetch(`/api/icons/search?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { icons?: IconRecord[]; hasMore?: boolean }) => {
        if (!active) return;
        setIcons(data.icons ?? []);
        setHasMore(!!data.hasMore);
      })
      .catch(() => {
        if (!active) return;
        setIcons([]);
        setHasMore(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deferredQuery, library]);

  const loadMore = () => {
    const params = new URLSearchParams({
      q: deferredQuery,
      library,
      limit: String(PAGE),
      offset: String(icons.length),
    });
    setLoading(true);
    fetch(`/api/icons/search?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { icons?: IconRecord[]; hasMore?: boolean }) => {
        const next = data.icons ?? [];
        setIcons((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...next.filter((i) => !seen.has(i.id))];
        });
        setHasMore(!!data.hasMore && next.length > 0);
      })
      .finally(() => setLoading(false));
  };

  const onSelect = async (icon: IconRecord) => {
    selectIcon({
      id: icon.id,
      name: icon.name,
      library: icon.libraryName,
      svg: icon.svg,
      keywords: icon.keywords,
    });
    await addRecent({
      iconId: icon.id,
      svg: icon.svg,
      name: icon.name,
      library: icon.library,
    });
  };

  const activeLabel =
    library === "all"
      ? "All libraries"
      : VISIBLE_LIBS.find((l) => l.id === library)?.name ?? "Library";

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
                className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-auto rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg"
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
                {VISIBLE_LIBS.map((l) => (
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-4 gap-0.5">
          {icons.map((icon) => (
            <button
              key={icon.id}
              title={icon.name}
              onClick={() => void onSelect(icon)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg transition-colors",
                selectedId === icon.id
                  ? "bg-[#0f9f8a]/15 text-[#0b7f6e]"
                  : "text-[var(--text)] hover:bg-black/[0.04]",
              )}
            >
              <span
                className="flex h-[20px] w-[20px] items-center justify-center text-current [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
                dangerouslySetInnerHTML={{ __html: icon.svg }}
              />
            </button>
          ))}
        </div>
        {!icons.length && !loading && (
          <p className="p-6 text-center text-xs text-[var(--text-secondary)]">
            No icons found
          </p>
        )}
        {hasMore && (
          <button
            type="button"
            disabled={loading}
            onClick={loadMore}
            className="mt-2 h-8 w-full rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] hover:bg-black/[0.03] disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
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
