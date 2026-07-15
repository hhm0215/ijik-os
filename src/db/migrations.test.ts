import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrateDatabase } from "./migrations";

const migrationsFolder = path.join(process.cwd(), "drizzle");

function tableExists(sqlite: Database.Database, name: string) {
  return Boolean(
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
      )
      .get(name)
  );
}

function applyRawMigrations(sqlite: Database.Database, count: number) {
  const migrations = readMigrationFiles({ migrationsFolder });
  for (const migration of migrations.slice(0, count)) {
    for (const statement of migration.sql) sqlite.exec(statement);
  }
}

function migrationCount(sqlite: Database.Database) {
  return (
    sqlite
      .prepare("SELECT count(*) AS count FROM __drizzle_migrations")
      .get() as { count: number }
  ).count;
}

function importDatabaseInChild(databasePath: string) {
  return new Promise<{ code: number | null; stderr: string }>((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--conditions=react-server",
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        'await import("./src/db/index.ts")',
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "test", DATABASE_PATH: databasePath },
        stdio: ["ignore", "ignore", "pipe"],
      }
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

describe("database migrations", () => {
  it("creates the complete schema for a fresh database", () => {
    const sqlite = new Database(":memory:");
    try {
      assert.deepEqual(migrateDatabase(sqlite, migrationsFolder), {
        baselined: false,
        applied: 3,
      });
      assert.equal(tableExists(sqlite, "experience_cards"), true);
      assert.equal(tableExists(sqlite, "user"), true);
      assert.equal(tableExists(sqlite, "session"), true);
      assert.equal(migrationCount(sqlite), 3);
    } finally {
      sqlite.close();
    }
  });

  it("baselines only the exact legacy schema and preserves its data", () => {
    const sqlite = new Database(":memory:");
    try {
      applyRawMigrations(sqlite, 1);
      sqlite
        .prepare(
          `INSERT INTO experience_cards
           (title, situation, role, action, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run("기존 카드", "상황", "역할", "행동", "2026-07-15", "2026-07-15");

      assert.deepEqual(migrateDatabase(sqlite, migrationsFolder), {
        baselined: true,
        applied: 2,
      });
      assert.equal(tableExists(sqlite, "user"), true);
      assert.equal(tableExists(sqlite, "account"), true);
      assert.equal(migrationCount(sqlite), 3);
      assert.equal(
        (
          sqlite.prepare("SELECT count(*) AS count FROM experience_cards").get() as {
            count: number;
          }
        ).count,
        1
      );
    } finally {
      sqlite.close();
    }
  });

  it("refuses a partial journal-less schema without modifying it", () => {
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(
        "CREATE TABLE experience_cards (id integer PRIMARY KEY, title text NOT NULL)"
      );
      assert.throws(
        () => migrateDatabase(sqlite, migrationsFolder),
        /알려진 초기 버전과 일치하지 않습니다/
      );
      assert.equal(tableExists(sqlite, "user"), false);
      assert.equal(tableExists(sqlite, "__drizzle_migrations"), false);
    } finally {
      sqlite.close();
    }
  });

  it("refuses an already auth-enabled database without a journal", () => {
    const sqlite = new Database(":memory:");
    try {
      applyRawMigrations(sqlite, 3);
      assert.throws(
        () => migrateDatabase(sqlite, migrationsFolder),
        /알려진 초기 버전과 일치하지 않습니다/
      );
      assert.equal(tableExists(sqlite, "user"), true);
      assert.equal(tableExists(sqlite, "__drizzle_migrations"), false);
    } finally {
      sqlite.close();
    }
  });

  it("refuses a migration history that does not match the committed SQL", () => {
    const sqlite = new Database(":memory:");
    try {
      migrateDatabase(sqlite, migrationsFolder);
      sqlite
        .prepare(
          "UPDATE __drizzle_migrations SET hash = 'changed' WHERE created_at = (SELECT max(created_at) FROM __drizzle_migrations)"
        )
        .run();
      assert.throws(
        () => migrateDatabase(sqlite, migrationsFolder),
        /마이그레이션 기록이 현재 코드와 일치하지 않습니다/
      );
    } finally {
      sqlite.close();
    }
  });

  it("serializes concurrent startup migrations across processes", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ijik-migration-"));
    const databasePath = path.join(tempDir, "legacy.db");
    const sqlite = new Database(databasePath);
    try {
      applyRawMigrations(sqlite, 1);
    } finally {
      sqlite.close();
    }

    try {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => importDatabaseInChild(databasePath))
      );
      for (const result of results) {
        assert.equal(result.code, 0, result.stderr);
      }

      const migrated = new Database(databasePath, { readonly: true });
      try {
        assert.equal(migrationCount(migrated), 3);
        assert.equal(tableExists(migrated, "user"), true);
      } finally {
        migrated.close();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
