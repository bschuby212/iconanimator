import { NextResponse } from "next/server";
import { searchIcons, type LibraryId } from "@/lib/icons/libraries";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const library = (searchParams.get("library") ?? "all") as LibraryId | "all";
  const limit = Number(searchParams.get("limit") ?? 100);
  try {
    const icons = await searchIcons(q, library, limit);
    return NextResponse.json({ icons });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed", icons: [] },
      { status: 500 },
    );
  }
}
