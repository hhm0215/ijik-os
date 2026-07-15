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

function claimLegacyGraphInChild(databasePath: string) {
  return new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        path.join(process.cwd(), "scripts/data-ownership-smoke.ts"),
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: "test", DATABASE_PATH: databasePath },
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

describe("database migrations", () => {
  it("creates the complete schema for a fresh database", () => {
    const sqlite = new Database(":memory:");
    try {
      assert.deepEqual(migrateDatabase(sqlite, migrationsFolder), {
        baselined: false,
        applied: 4,
      });
      assert.equal(tableExists(sqlite, "experience_cards"), true);
      assert.equal(tableExists(sqlite, "user"), true);
      assert.equal(tableExists(sqlite, "session"), true);
      assert.equal(migrationCount(sqlite), 4);
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
        applied: 3,
      });
      assert.equal(tableExists(sqlite, "user"), true);
      assert.equal(tableExists(sqlite, "account"), true);
      assert.equal(migrationCount(sqlite), 4);
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

  it("keeps legacy rows claimable while rejecting new NULL ownership", () => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    try {
      applyRawMigrations(sqlite, 3);
      sqlite
        .prepare(
          `INSERT INTO experience_cards
           (title, situation, role, action, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run("기존 카드", "상황", "역할", "행동", "2026-07-15", "2026-07-15");

      const ownershipMigration = readMigrationFiles({ migrationsFolder })[3];
      assert.ok(ownershipMigration);
      for (const statement of ownershipMigration.sql) sqlite.exec(statement);

      assert.equal(
        (
          sqlite
            .prepare(
              `SELECT count(*) AS count
               FROM sqlite_master
               WHERE type = 'trigger'
                 AND (name GLOB '*_user_id_insert_guard'
                   OR name GLOB '*_user_id_update_guard')`
            )
            .get() as { count: number }
        ).count,
        22
      );
      assert.equal(
        (
          sqlite
            .prepare("SELECT user_id AS userId FROM experience_cards")
            .get() as { userId: string | null }
        ).userId,
        null
      );
      assert.throws(
        () =>
          sqlite
            .prepare(
              `INSERT INTO experience_cards
               (title, situation, role, action, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run("새 카드", "상황", "역할", "행동", "2026-07-15", "2026-07-15"),
        /experience_cards\.user_id is required/
      );
      assert.throws(
        () =>
          sqlite
            .prepare("UPDATE experience_cards SET title = ? WHERE id = 1")
            .run("미귀속 변경"),
        /experience_cards\.user_id is required/
      );

      sqlite
        .prepare(
          `INSERT INTO user
           (id, name, email, email_verified, created_at, updated_at, role)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run("operator", "운영자", "operator@example.com", 1, 1, 1, "admin");
      sqlite
        .prepare("UPDATE experience_cards SET user_id = ? WHERE id = 1")
        .run("operator");
      sqlite
        .prepare("UPDATE experience_cards SET title = ? WHERE id = 1")
        .run("귀속 후 변경");

      sqlite
        .prepare(
          `INSERT INTO user
           (id, name, email, email_verified, created_at, updated_at, role)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run("user-b", "사용자 B", "user-b@example.com", 1, 1, 1, "user");
      const postingId = Number(
        sqlite
          .prepare(
            `INSERT INTO job_postings (user_id, raw_text, collected_at)
             VALUES (?, ?, ?)`
          )
          .run("operator", "테스트 공고 본문", "2026-07-15").lastInsertRowid
      );
      const requirementId = Number(
        sqlite
          .prepare(
            `INSERT INTO requirements
             (user_id, job_posting_id, category, text)
             VALUES (?, ?, ?, ?)`
          )
          .run("operator", postingId, "tech", "테스트 요구사항").lastInsertRowid
      );
      const userBCardId = Number(
        sqlite
          .prepare(
            `INSERT INTO experience_cards
             (user_id, title, situation, role, action, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            "user-b",
            "B 카드",
            "상황",
            "역할",
            "행동",
            "2026-07-15",
            "2026-07-15"
          ).lastInsertRowid
      );
      assert.throws(
        () =>
          sqlite
            .prepare(
              `INSERT INTO matches
               (user_id, requirement_id, card_id, strength)
               VALUES (?, ?, ?, ?)`
            )
            .run("operator", requirementId, userBCardId, "strong"),
        /matches\.user_id is required/
      );
      sqlite
        .prepare(
          `INSERT INTO matches
           (user_id, requirement_id, card_id, strength)
           VALUES (?, ?, ?, ?)`
        )
        .run("operator", requirementId, 1, "strong");

      assert.throws(
        () => sqlite.prepare("DELETE FROM user WHERE id = ?").run("operator"),
        /FOREIGN KEY constraint failed/
      );
    } finally {
      sqlite.close();
    }
  });

  it("claims a legacy placeholder graph in parent-first ownership order", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ijik-ownership-"));
    const databasePath = path.join(tempDir, "legacy.db");
    const sqlite = new Database(databasePath);
    sqlite.pragma("foreign_keys = ON");
    try {
      applyRawMigrations(sqlite, 3);
      sqlite.exec(`
        CREATE TABLE "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at numeric
        )
      `);
      const journal = sqlite.prepare(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
      );
      for (const migration of readMigrationFiles({ migrationsFolder }).slice(
        0,
        3
      )) {
        journal.run(migration.hash, migration.folderMillis);
      }
      const cardId = Number(
        sqlite
          .prepare(
            `INSERT INTO experience_cards
             (title, situation, role, action, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            "기존 카드",
            "상황",
            "역할",
            "행동",
            "2026-07-15",
            "2026-07-15"
          ).lastInsertRowid
      );
      const postingId = Number(
        sqlite
          .prepare(
            `INSERT INTO job_postings (raw_text, collected_at)
             VALUES (?, ?)`
          )
          .run("기존 공고 본문", "2026-07-15").lastInsertRowid
      );
      const requirementId = Number(
        sqlite
          .prepare(
            `INSERT INTO requirements (job_posting_id, category, text)
             VALUES (?, ?, ?)`
          )
          .run(postingId, "tech", "기존 요구사항").lastInsertRowid
      );
      sqlite
        .prepare(
          `INSERT INTO matches (requirement_id, card_id, strength)
           VALUES (?, ?, ?)`
        )
        .run(requirementId, cardId, "strong");
      const askbackId = Number(
        sqlite
          .prepare(
            `INSERT INTO askbacks
             (job_posting_id, requirement_id, question, created_at)
             VALUES (?, ?, ?, ?)`
          )
          .run(
            postingId,
            requirementId,
            "기존 되묻기",
            "2026-07-15"
          ).lastInsertRowid
      );
      const draftId = Number(
        sqlite
          .prepare(
            `INSERT INTO drafts (job_posting_id, kind, created_at)
             VALUES (?, ?, ?)`
          )
          .run(postingId, "intro", "2026-07-15").lastInsertRowid
      );
      const sentenceId = Number(
        sqlite
          .prepare(
            `INSERT INTO draft_sentences
             (draft_id, text, type, askback_id)
             VALUES (?, ?, ?, ?)`
          )
          .run(draftId, "되묻기 답변 필요", "placeholder", askbackId)
          .lastInsertRowid
      );
      sqlite
        .prepare(
          `INSERT INTO draft_sentence_sources (sentence_id, card_id)
           VALUES (?, ?)`
        )
        .run(sentenceId, cardId);
      const questionId = Number(
        sqlite
          .prepare(
            `INSERT INTO interview_questions
             (job_posting_id, question, qtype)
             VALUES (?, ?, ?)`
          )
          .run(postingId, "기존 면접 질문", "posting").lastInsertRowid
      );
      sqlite
        .prepare(
          `INSERT INTO interview_answer_points
           (question_id, text, type, primary_source_card_id)
           VALUES (?, ?, ?, ?)`
        )
        .run(questionId, "기존 답변 포인트", "ai", cardId);
      sqlite
        .prepare(
          `INSERT INTO applications
           (job_posting_id, applied_at, updated_at)
           VALUES (?, ?, ?)`
        )
        .run(postingId, "2026-07-15", "2026-07-15");
    } finally {
      sqlite.close();
    }

    try {
      const result = await claimLegacyGraphInChild(databasePath);
      assert.equal(
        result.code,
        0,
        `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`
      );
      assert.match(result.stdout, /data-ownership-smoke-ok/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
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
        assert.equal(migrationCount(migrated), 4);
        assert.equal(tableExists(migrated, "user"), true);
      } finally {
        migrated.close();
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
