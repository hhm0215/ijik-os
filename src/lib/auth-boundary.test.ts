import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function findFiles(directory: string, filename: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(relative, filename);
    return entry.name === filename ? [relative] : [];
  });
}

describe("authentication boundary", () => {
  it("wraps every domain route with the secure owner route guard", () => {
    const publicRoutes = new Set([
      "src/app/api/setup/route.ts",
      "src/app/api/auth/[...all]/route.ts",
    ]);
    const domainRoutes = findFiles("src/app/api", "route.ts").filter(
      (file) => !publicRoutes.has(file)
    );
    assert.ok(domainRoutes.length > 0);
    for (const file of domainRoutes) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      assert.match(source, /ownerRoute\(/, `${file} is missing ownerRoute`);
      assert.doesNotMatch(
        source,
        /export async function (GET|POST|PUT|PATCH|DELETE)/,
        `${file} exports an unwrapped handler`
      );
    }
  });

  it("checks a database-backed session in every protected page", () => {
    const publicPages = new Set([
      "src/app/login/page.tsx",
      "src/app/setup/page.tsx",
    ]);
    const protectedPages = findFiles("src/app", "page.tsx").filter(
      (file) => !publicPages.has(file)
    );
    assert.ok(protectedPages.length > 0);
    for (const file of protectedPages) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      assert.match(
        source,
        /requirePageSession\(\)/,
        `${file} is missing requirePageSession`
      );
    }
  });

  it("keeps public email registration disabled", () => {
    const source = fs.readFileSync(path.join(root, "src/lib/auth.ts"), "utf8");
    assert.match(source, /disableSignUp:\s*true/);
  });

  it("keeps runtime secrets and database backups out of build and Git contexts", () => {
    const dockerIgnore = fs.readFileSync(path.join(root, ".dockerignore"), "utf8");
    const gitIgnore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
    assert.match(dockerIgnore, /^\.env\*$/m);
    assert.match(dockerIgnore, /^backups$/m);
    assert.match(dockerIgnore, /^\*\.db$/m);
    assert.match(gitIgnore, /^\/backups\/$/m);
    assert.match(gitIgnore, /^\*\.db$/m);
  });
});
