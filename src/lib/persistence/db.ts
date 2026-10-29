import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ProjectState } from "@/lib/animation/types";

interface AnimatorDB extends DBSchema {
  projects: {
    key: string;
    value: ProjectState;
    indexes: { "by-updated": number };
  };
  favorites: {
    key: string;
    value: { id: string; iconId: string; createdAt: number };
  };
  recent: {
    key: string;
    value: { id: string; iconId: string; svg: string; name: string; library: string; usedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<AnimatorDB>> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<AnimatorDB>("ai-icon-animator", 1, {
      upgrade(db) {
        const projects = db.createObjectStore("projects", { keyPath: "id" });
        projects.createIndex("by-updated", "updatedAt");
        db.createObjectStore("favorites", { keyPath: "id" });
        db.createObjectStore("recent", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

const memoryProjects = new Map<string, ProjectState>();

export async function saveProject(project: ProjectState): Promise<void> {
  const next = { ...project, updatedAt: Date.now() };
  memoryProjects.set(next.id, next);
  const db = getDb();
  if (!db) return;
  await (await db).put("projects", next);
}

export async function loadProject(id: string): Promise<ProjectState | undefined> {
  const db = getDb();
  if (!db) return memoryProjects.get(id);
  return (await db).get("projects", id);
}

export async function listProjects(): Promise<ProjectState[]> {
  const db = getDb();
  if (!db) {
    return [...memoryProjects.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
  const all = await (await db).getAllFromIndex("projects", "by-updated");
  return all.reverse();
}

export async function deleteProject(id: string): Promise<void> {
  memoryProjects.delete(id);
  const db = getDb();
  if (!db) return;
  await (await db).delete("projects", id);
}

export async function addFavorite(iconId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await (await db).put("favorites", {
    id: iconId,
    iconId,
    createdAt: Date.now(),
  });
}

export async function listFavorites(): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const all = await (await db).getAll("favorites");
  return all.map((f) => f.iconId);
}

export async function addRecent(icon: {
  iconId: string;
  svg: string;
  name: string;
  library: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  await (await db).put("recent", {
    id: icon.iconId,
    ...icon,
    usedAt: Date.now(),
  });
}

export async function listRecent(limit = 20) {
  const db = getDb();
  if (!db) return [];
  const all = await (await db).getAll("recent");
  return all.sort((a, b) => b.usedAt - a.usedAt).slice(0, limit);
}
