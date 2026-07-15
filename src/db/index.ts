import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrateDatabase } from "./migrations";
import * as schema from "./schema";

const configuredPath = process.env.DATABASE_PATH?.trim();
const databasePath =
  configuredPath === ":memory:"
    ? configuredPath
    : path.resolve(
        /* turbopackIgnore: true */ process.cwd(),
        configuredPath || "data/app.db"
      );
if (databasePath !== ":memory:") {
  const databaseDirectory = path.dirname(
    /* turbopackIgnore: true */ databasePath
  );
  fs.mkdirSync(/* turbopackIgnore: true */ databaseDirectory, {
    recursive: true,
    mode: 0o700,
  });
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(/* turbopackIgnore: true */ file)) {
      fs.chmodSync(/* turbopackIgnore: true */ file, 0o600);
    }
  }
}

const sqlite = new Database(/* turbopackIgnore: true */ databasePath);
if (databasePath !== ":memory:") {
  fs.chmodSync(/* turbopackIgnore: true */ databasePath, 0o600);
}
sqlite.pragma("busy_timeout = 30000");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
if (databasePath !== ":memory:") {
  for (const file of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (fs.existsSync(/* turbopackIgnore: true */ file)) {
      fs.chmodSync(/* turbopackIgnore: true */ file, 0o600);
    }
  }
}

const migrationsFolder = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "drizzle"
);
migrateDatabase(sqlite, migrationsFolder);

export const db = drizzle(sqlite, { schema });

export * from "./schema";
