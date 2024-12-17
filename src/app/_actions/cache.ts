"use server";

import { db } from "~/server/db";
import { eq, and } from "drizzle-orm";
import { diagramCache } from "~/server/db/schema";

export async function getCachedDiagram(username: string, repo: string) {
  try {
    const cached = await db
      .select()
      .from(diagramCache)
      .where(
        and(eq(diagramCache.username, username), eq(diagramCache.repo, repo)),
      )
      .limit(1);

    return cached[0]?.diagram ?? null;
  } catch (error) {
    console.error("Error fetching cached diagram:", error);
    return null;
  }
}

export async function cacheDiagram(
  username: string,
  repo: string,
  diagram: string,
) {
  try {
    await db
      .insert(diagramCache)
      .values({
        username,
        repo,
        diagram,
      })
      .onConflictDoUpdate({
        target: [diagramCache.username, diagramCache.repo],
        set: {
          diagram,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error("Error caching diagram:", error);
  }
}