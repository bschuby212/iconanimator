"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { Heart, Search, Upload } from "lucide-react";
import { LIBRARIES, searchIcons, type IconRecord, type LibraryId } from "@/lib/icons/libraries";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import { addFavorite, addRecent, listFavorites } from "@/lib/persistence/db";

export function IconBrowser() {
  const selectIcon = useProjectStore((s) => s.selectIcon);
  const uploadSvg = useProjectStore((s) => s.uploadSvg);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [library, setLibrary] = useState<LibraryId | "all">("tabler");
  const [icons, setIcons] = useState<IconRecord[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"browse" | "favorites" | "recent">("browse");

  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      searchIcons(deferredQuery, library, 100).then((res) => {
        if (!cancelled) setIcons(res);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [deferredQuery, library]);

  useEffect(() => {
    listFavorites().then(setFavorites).catch(() => undefined);
  }, []);

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

  const onUpload = async (file: File) => {
    const text = await file.text();
    uploadSvg(text, file.name.replace(/\.svg$/i, ""));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text)]">Icons</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".svg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
              }}
            />
            <span className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-white px-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg)]">
              <Upload className="h-3.5 w-3.5" />
              SVG
            </span>
          </label>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="h-8 w-full rounded-md border border-[var(--border)] bg-white pl-8 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <select
          value={library}
          onChange={(e) => setLibrary(e.target.value as LibraryId | "all")}
          className="h-8 w-full rounded-md border border-[var(--border)] bg-white px-2 text-xs outline-none"
        >
          <option value="all">All libraries</option>
          {LIBRARIES.map((l) => (
            <option key={l.id} value={l.id} disabled={l.id === "hugeicons"}>
              {l.name}
              {l.id === "hugeicons" ? " (soon)" : ""}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {(["browse", "favorites", "recent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2 py-1 text-xs capitalize",
                tab === t
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-black/5",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {pending && (
          <p className="px-1 pb-2 text-xs text-[var(--text-secondary)]">Searching…</p>
        )}
        <div className="grid grid-cols-4 gap-1.5">
          {icons
            .filter((icon) =>
              tab === "favorites" ? favorites.includes(icon.id) : true,
            )
            .map((icon) => (
              <button
                key={icon.id}
                title={`${icon.name} · ${icon.libraryName}`}
                onClick={() => void onSelect(icon)}
                className="group relative flex aspect-square items-center justify-center rounded-md border border-transparent bg-white hover:border-[var(--border)] hover:shadow-sm"
              >
                <span
                  className="h-5 w-5 text-[var(--text)] [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: icon.svg }}
                />
                <span
                  role="button"
                  className="absolute right-0.5 top-0.5 hidden rounded p-0.5 text-[var(--text-secondary)] hover:text-red-500 group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    void addFavorite(icon.id).then(() =>
                      listFavorites().then(setFavorites),
                    );
                  }}
                >
                  <Heart className="h-3 w-3" />
                </span>
              </button>
            ))}
        </div>
        {!icons.length && (
          <p className="p-4 text-center text-xs text-[var(--text-secondary)]">
            No icons found
          </p>
        )}
      </div>
      <div className="border-t border-[var(--border)] p-2 text-[10px] text-[var(--text-secondary)]">
        Open-source libraries · respect each license
      </div>
    </div>
  );
}
