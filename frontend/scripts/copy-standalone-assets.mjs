/**
 * Post-build script: copies .next/static + public into standalone output.
 *
 * Next.js `output: "standalone"` intentionally excludes these directories
 * (they can be served by CDN). For self-contained deployments, we must copy
 * them into .next/standalone/ so that server.js can serve JS/CSS chunks.
 *
 * Runs automatically via `postbuild` npm script: next build → node scripts/copy-standalone-assets.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function fail(msg) {
  console.error(`\x1b[31m[standalone]\x1b[0m ${msg}`);
  process.exit(1);
}

function info(msg) {
  console.log(`\x1b[36m[standalone]\x1b[0m ${msg}`);
}

function ok(msg) {
  console.log(`\x1b[32m[standalone]\x1b[0m ${msg}`);
}

const standaloneDir = join(root, ".next", "standalone");
if (!existsSync(standaloneDir)) {
  info("no .next/standalone/ — skipping (not using output:standalone)");
  process.exit(0);
}

// ── 1. Copy .next/static → .next/standalone/.next/static ──
const srcStatic = join(root, ".next", "static");
const dstStatic = join(standaloneDir, ".next", "static");

if (!existsSync(srcStatic)) {
  fail(".next/static/ missing — build may have failed");
}

// Check BUILD_ID match to detect stale standalone
const mainBuildId = readFileSync(join(root, ".next", "BUILD_ID"), "utf-8").trim();
const standaloneBuildIdFile = join(standaloneDir, ".next", "BUILD_ID");
let standaloneBuildId = "";
try {
  standaloneBuildId = readFileSync(standaloneBuildIdFile, "utf-8").trim();
} catch {
  // first build, no stale issue
}

if (standaloneBuildId && mainBuildId !== standaloneBuildId) {
  info(`BUILD_ID mismatch (main: ${mainBuildId}, standalone: ${standaloneBuildId}) — removing stale static`);
  const rm = (p) => {
    try { require("node:fs").rmSync(p, { recursive: true, force: true }); } catch {}
  };
  rm(dstStatic);
  rm(join(standaloneDir, "public"));
}

info("copying .next/static/ → .next/standalone/.next/static/ ...");
mkdirSync(dirname(dstStatic), { recursive: true });
cpSync(srcStatic, dstStatic, { recursive: true });
ok(".next/static/ copied");

// ── 2. Copy public/ → .next/standalone/public/ ──
const srcPublic = join(root, "public");
const dstPublic = join(standaloneDir, "public");
if (existsSync(srcPublic)) {
  info("copying public/ → .next/standalone/public/ ...");
  cpSync(srcPublic, dstPublic, { recursive: true });
  const pubCount = readdirSync(dstPublic, { recursive: true }).length;
  ok(`public/ copied (${pubCount} files)`);
}

// ── 3. Verify ──
const chunksDir = join(dstStatic, "chunks");
if (!existsSync(chunksDir)) {
  fail("standalone .next/static/chunks/ missing — JS chunks will 404!");
}

const jsFiles = readdirSync(chunksDir, { recursive: false }).filter(f => f.endsWith(".js"));
if (jsFiles.length === 0) {
  fail("standalone .next/static/chunks/ has no .js files — build may be incomplete");
}

ok(`verified: ${jsFiles.length} JS chunks in standalone (BUILD_ID: ${mainBuildId})`);
console.log("");
