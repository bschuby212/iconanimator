"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { Search, Upload } from "lucide-react";
import { LIBRARIES, type IconRecord, type LibraryId } from "@/lib/icons/libraries";
import { useProjectStore } from "@/store/project-store";
import { cn } from "@/lib/utils/cn";
import { addRecent } from "@/lib/persistence/db";

export function IconBrowser() {
  const selectIcon = useProjectStore((s) => s.selectIcon);
  const uploadSvg = useProjectStore((s) => s.uploadSvg);
  const selectedId = useProjectStore((s) => s.project.icon?.id);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [library, setLibrary] = useState<LibraryId | "all">("tabler");
  const [icons, setIcons] = useState<IconRecord[]>([]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      q: deferredQuery,
      library,
      limit: "120",
    });
    fetch(`/api/icons/search?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { icons?: IconRecord[] }) => {
        if (active) setIcons(data.icons ?? []);
      })
      .catch(() => {
        if (active) setIcons([]);
      });
    return () => {
      active = false;
    };
  }, [deferredQuery, library]);

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

  return (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <div className="space-y-2 border-b border-[var(--border)] p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            className="h-8 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent)] focus:bg-white"
          />
        </div>
        <div className="flex gap-1.5">
          <select
            value={library}
            onChange={(e) => setLibrary(e.target.value as LibraryId | "all")}
            className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-white px-2 text-xs outline-none"
          >
            <option value="all">All libraries</option>
            {LIBRARIES.filter((l) => l.id !== "hugeicons").map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
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
            SVG
          </label>
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
                className="h-[18px] w-[18px] [&_svg]:h-full [&_svg]:w-full"
                dangerouslySetInnerHTML={{ __html: icon.svg }}
              />
            </button>
          ))}
        </div>
        {!icons.length && (
          <p className="p-6 text-center text-xs text-[var(--text-secondary)]">
            No icons found
          </p>
        )}
      </div>
    </div>
  );
}
