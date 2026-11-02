"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ChevronDown, Search, Upload } from "lucide-react";
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

const controlClass =
  "h-8 rounded-md border border-[var(--border)] bg-white text-xs text-[var(--text)] transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]";

export function IconBrowser() {
  const selectIcon = useProjectStore((s) => s.selectIcon);
  const uploadSvg = useProjectStore((s) => s.uploadSvg);
  const clearIconKeepText = useProjectStore((s) => s.clearIconKeepText);
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
  /** Last family placed — only for variant switching, not grid highlight */
  const [variantFamily, setVariantFamily] = useState<IconRecord | null>(null);
  const [variantId, setVariantId] = useState<string>("regular");
  const [pressedId, setPressedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const icons =
    page?.q === deferredQuery && page?.library === library ? page.icons : [];
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
        // Clear variant chrome when the grid context changes
        setVariantFamily(null);
        setPage({
          q,
          library: lib,
          icons: data.icons ?? [],
          hasMore: !!data.hasMore,
        });
      })
      .catch(() => {
        if (!active) return;
        setVariantFamily(null);
        setPage({ q, library: lib, icons: [], hasMore: false });
      });
    return () => {
      active = false;
    };
  }, [deferredQuery, library]);

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

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

  const flashPress = (id: string) => {
    setPressedId(id);
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => setPressedId(null), 160);
  };

  const placeIcon = async (
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

  const onPickIcon = (icon: IconRecord) => {
    flashPress(icon.id);
    setVariantFamily(icon.variants.length > 1 ? icon : null);
    setVariantId(icon.defaultVariant);
    const v =
      icon.variants.find((x) => x.id === icon.defaultVariant) ??
      icon.variants[0];
    void placeIcon(icon, v?.id ?? icon.defaultVariant, v?.svg ?? icon.svg);
  };

  const onVariantChange = (next: string) => {
    if (!variantFamily) return;
    setVariantId(next);
    const v = variantFamily.variants.find((x) => x.id === next);
    if (!v) return;
    void placeIcon(variantFamily, next, v.svg);
  };

  const onUpload = async (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") {
      setUploadError("Please choose an SVG file.");
      return;
    }
    try {
      const text = await file.text();
      if (!text.includes("<svg") && !text.includes("<path")) {
        setUploadError("That file doesn’t look like a valid SVG.");
        return;
      }
      uploadSvg(text, file.name.replace(/\.svg$/i, "") || "custom-icon");
      setVariantFamily(null);
    } catch {
      setUploadError("Couldn’t read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const activeLabel =
    library === "all"
      ? "All libraries"
      : LIBRARIES.find((l) => l.id === library)?.name ?? "Library";

  const showVariantBar =
    !!variantFamily && variantFamily.variants.length > 1;

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="space-y-2 border-b border-[var(--border)] p-3">
        <div className="relative w-full" ref={menuRef}>
          <button
            type="button"
            className={cn(
              controlClass,
              "flex w-full items-center gap-1.5 px-2 text-left",
            )}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-label="Icon library"
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
              className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-md border border-[var(--border)] bg-white py-1 shadow-md"
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

        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              library === "all" ? "Search icons…" : `Search ${activeLabel}…`
            }
            aria-label="Search icons"
            className={cn(
              controlClass,
              "w-full bg-[var(--bg)] pl-8 pr-3 text-[13px] placeholder:text-[var(--text-secondary)] focus:bg-white focus:border-[var(--accent)]",
            )}
          />
        </div>

        <label
          className={cn(
            controlClass,
            "flex w-full cursor-pointer items-center justify-center gap-1.5 px-2.5 text-[var(--text-secondary)] hover:text-[var(--text)]",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={(e) => void onUpload(e.target.files?.[0])}
          />
          <Upload className="h-3.5 w-3.5" />
          Upload SVG
        </label>

        {uploadError && (
          <p className="text-[11px] text-red-600" role="alert">
            {uploadError}
          </p>
        )}

        {hasIcon && hasText && (
          <button
            type="button"
            onClick={() => clearIconKeepText()}
            className={cn(
              controlClass,
              "w-full px-2 text-[var(--text-secondary)] hover:text-[var(--text)]",
            )}
            title="Remove icon, keep text"
          >
            Icon off
          </button>
        )}

        {showVariantBar && (
          <div className="flex flex-wrap gap-1" data-testid="icon-variant-bar">
            {variantFamily!.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onVariantChange(v.id)}
                className={cn(
                  "h-7 rounded-md border px-2 text-[11px] font-medium transition-colors",
                  variantId === v.id
                    ? "border-[var(--border)] bg-black/[0.06] text-[var(--text)]"
                    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text)]",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        <div className="grid grid-cols-4 gap-0.5">
          {icons.map((icon) => {
            const pressed = pressedId === icon.id;
            return (
              <button
                key={icon.id}
                type="button"
                title={
                  library === "all"
                    ? `${icon.name} · ${icon.libraryName}`
                    : icon.name
                }
                onClick={() => onPickIcon(icon)}
                data-testid={`icon-card-${icon.id}`}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center rounded-md text-[var(--text)] transition-colors",
                  "hover:bg-black/[0.045]",
                  "active:bg-black/[0.07]",
                  pressed && "bg-black/[0.07]",
                )}
              >
                <span
                  className="pointer-events-none flex h-5 w-5 items-center justify-center [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: icon.svg }}
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
            className={cn(
              controlClass,
              "mt-2 w-full font-medium text-[var(--text-secondary)] disabled:opacity-50",
            )}
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
          "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors",
          active
            ? "bg-black/[0.05] font-medium text-[var(--text)]"
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
