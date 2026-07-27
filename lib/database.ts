export type D1PreparedStatementLike = {
  bind: (...values: unknown[]) => D1PreparedStatementLike;
  first: <T>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatementLike;
};

type NetlifyDatabaseClient = ReturnType<
  (typeof import("@netlify/database"))["getDatabase"]
>;

type RuntimeEnv = {
  DB?: D1DatabaseLike;
};

export function getD1Database(): D1DatabaseLike | null {
  return (
    (
      globalThis as typeof globalThis & {
        __CANOPY_RUNTIME_ENV__?: RuntimeEnv;
      }
    ).__CANOPY_RUNTIME_ENV__?.DB ?? null
  );
}

export async function getNetlifyDatabase(): Promise<NetlifyDatabaseClient | null> {
  const connectionString = process.env.NETLIFY_DB_URL;
  const isNetlifyRuntime =
    process.env.NETLIFY === "true" || Boolean(connectionString);
  if (!isNetlifyRuntime) return null;

  const { getDatabase } = await import("@netlify/database");
  return connectionString
    ? getDatabase({ connectionString })
    : getDatabase();
}
