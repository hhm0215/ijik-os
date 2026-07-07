import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(path.join(dataDir, "app.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// 빈 DB(Docker 첫 기동 등)면 스키마 자동 생성.
// 이미 db:push로 만들어진 기존 DB는 건드리지 않는다 — 이후 스키마 변경은
// drizzle-kit generate → 마이그레이션 파일 커밋 방식으로 관리할 것.
const initialized = sqlite
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='experience_cards'"
  )
  .get();
if (!initialized) {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}

export * from "./schema";
