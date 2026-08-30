import { drizzle } from "drizzle-orm/d1";
import { getD1Database } from "@/lib/database";
import * as schema from "./schema";

export function getDb() {
  const d1 = getD1Database();
  if (!d1) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable in this runtime.",
    );
  }

  return drizzle(d1 as Parameters<typeof drizzle>[0], { schema });
}
