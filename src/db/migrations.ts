import Database from "better-sqlite3";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";

type SqliteDatabase = InstanceType<typeof Database>;

type SchemaObject = {
  type: string;
  name: string;
  tableName: string;
  sql: string;
};

type MigrationRow = {
  hash: string;
  createdAt: number;
};

function normalizeSchemaSql(sql: string) {
  return sql
    .replace(/[\u0060\u0022]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([(),])\s*/g, "$1")
    .replace(/\s*=\s*/g, "=")
    .trim()
    .toLowerCase();
}

function schemaObjects(sqlite: SqliteDatabase): SchemaObject[] {
  return sqlite
    .prepare(
      `SELECT type, name, tbl_name AS tableName, sql
       FROM sqlite_master
       WHERE type IN ('table', 'index', 'trigger', 'view')
         AND name NOT LIKE 'sqlite_%'
         AND name <> '__drizzle_migrations'
         AND sql IS NOT NULL
       ORDER BY type, name`
    )
    .all()
    .map((row) => {
      const object = row as SchemaObject;
      return { ...object, sql: normalizeSchemaSql(object.sql) };
    });
}

function expectedLegacySchema(baseline: MigrationMeta) {
  const reference = new Database(":memory:");
  try {
    for (const statement of baseline.sql) reference.exec(statement);
    return schemaObjects(reference);
  } finally {
    reference.close();
  }
}

function assertExactLegacySchema(
  sqlite: SqliteDatabase,
  baseline: MigrationMeta
) {
  const actual = schemaObjects(sqlite);
  const expected = expectedLegacySchema(baseline);
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;

  const actualNames = actual.map((object) => object.name).join(", ") || "없음";
  throw new Error(
    "마이그레이션 기록이 없는 DB의 스키마가 알려진 초기 버전과 일치하지 않습니다. " +
      `자동 변경을 중단했습니다 (발견 객체: ${actualNames}). 백업 후 수동 점검이 필요합니다.`
  );
}

function validateMigrationHistory(
  rows: MigrationRow[],
  migrations: MigrationMeta[]
) {
  if (rows.length > migrations.length) {
    throw new Error(
      "DB 마이그레이션 기록이 현재 코드보다 앞서 있습니다. 자동 변경을 중단했습니다."
    );
  }
  for (const [index, row] of rows.entries()) {
    const expected = migrations[index];
    if (
      !expected ||
      Number(row.createdAt) !== expected.folderMillis ||
      row.hash !== expected.hash
    ) {
      throw new Error(
        "DB 마이그레이션 기록이 현재 코드와 일치하지 않습니다. 자동 변경을 중단했습니다."
      );
    }
  }
}

/**
 * Applies committed migrations while holding SQLite's process-wide write lock.
 *
 * Early installations were created with `drizzle-kit push` and have no journal.
 * Only the exact 0000 schema is eligible for an automatic baseline; partial or
 * already-auth-enabled databases stop without being modified.
 */
export function migrateDatabase(
  sqlite: SqliteDatabase,
  migrationsFolder: string
) {
  const migrations = readMigrationFiles({ migrationsFolder });
  const baseline = migrations[0];
  if (!baseline) throw new Error("초기 Drizzle 마이그레이션을 찾을 수 없습니다.");

  sqlite.pragma("busy_timeout = 30000");
  sqlite.exec("BEGIN IMMEDIATE");
  let baselined = false;
  let applied = 0;

  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      )
    `);

    let rows = sqlite
      .prepare(
        `SELECT hash, created_at AS createdAt
         FROM __drizzle_migrations
         ORDER BY created_at ASC`
      )
      .all() as MigrationRow[];

    if (rows.length === 0 && schemaObjects(sqlite).length > 0) {
      assertExactLegacySchema(sqlite, baseline);
      sqlite
        .prepare(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
        )
        .run(baseline.hash, baseline.folderMillis);
      rows = [{ hash: baseline.hash, createdAt: baseline.folderMillis }];
      baselined = true;
    }

    validateMigrationHistory(rows, migrations);
    const lastAppliedAt = rows.at(-1)?.createdAt ?? -1;
    const insertJournal = sqlite.prepare(
      "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
    );

    for (const migration of migrations) {
      if (Number(lastAppliedAt) >= migration.folderMillis) continue;
      for (const statement of migration.sql) sqlite.exec(statement);
      insertJournal.run(migration.hash, migration.folderMillis);
      applied += 1;
    }

    sqlite.exec("COMMIT");
    return { baselined, applied };
  } catch (error) {
    if (sqlite.inTransaction) sqlite.exec("ROLLBACK");
    throw error;
  }
}
