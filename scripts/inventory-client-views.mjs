// Lập danh sách mọi chỗ trong clientDefs trỏ tới module JS của UI classic (view, handler, controller, acl...).
// Những chỗ này không dùng lại được trên Next.js: hoặc engine chung xử lý, hoặc phải làm trong overrides/<Scope>/.
// Kết quả: docs/inventory-client-views.md. Chạy: npm run inventory:client-views
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const espoRoot = path.resolve(process.env.ESPO_ROOT ?? "../EspoCRM-10.0.9");
const outputFile = "docs/inventory-client-views.md";

const JS_MODULE_REF = /^(?:[\w-]+:)?(?:views|handlers|controllers|acl|acl-portal|helpers)\/[\w\-/]+$/;

async function listDirs(dir) {
  try {
    return (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function collectSources() {
  const sources = [["core", "application/Espo/Resources/metadata/clientDefs"]];

  for (const moduleName of await listDirs(path.join(espoRoot, "application/Espo/Modules"))) {
    sources.push([moduleName, `application/Espo/Modules/${moduleName}/Resources/metadata/clientDefs`]);
  }

  for (const moduleName of await listDirs(path.join(espoRoot, "custom/Espo/Modules"))) {
    sources.push([`custom:${moduleName}`, `custom/Espo/Modules/${moduleName}/Resources/metadata/clientDefs`]);
  }

  sources.push(["custom", "custom/Espo/Custom/Resources/metadata/clientDefs"]);

  return sources;
}

function walk(value, jsonPath, found) {
  if (typeof value === "string") {
    if (JS_MODULE_REF.test(value)) {
      found.push({ jsonPath, ref: value });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${jsonPath}[${i}]`, found));

    return;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      walk(item, jsonPath ? `${jsonPath}.${key}` : key, found);
    }
  }
}

const entries = [];

for (const [source, relDir] of await collectSources()) {
  const dir = path.join(espoRoot, relDir);
  let files;

  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    continue;
  }

  for (const file of files) {
    const scope = file.replace(/\.json$/, "");
    const found = [];
    walk(JSON.parse(await readFile(path.join(dir, file), "utf8")), "", found);

    for (const item of found) {
      entries.push({ scope, source, ...item });
    }
  }
}

const byRef = new Map();

for (const entry of entries) {
  const scopes = byRef.get(entry.ref) ?? new Set();
  scopes.add(entry.scope);
  byRef.set(entry.ref, scopes);
}

const byScope = new Map();

for (const entry of entries) {
  const list = byScope.get(entry.scope) ?? [];
  list.push(entry);
  byScope.set(entry.scope, list);
}

const lines = [
  "# Danh sách view JS tùy biến trong clientDefs",
  "",
  `Sinh tự động bởi \`scripts/inventory-client-views.mjs\` từ \`${espoRoot}\`. Không sửa tay.`,
  "",
  `Tổng: ${entries.length} tham chiếu, ${byRef.size} module JS khác nhau, ${byScope.size} scope.`,
  "",
  "## Theo module JS",
  "",
  "Module dùng ở nhiều scope thường là hành vi chung, nên làm trong engine; module chỉ dùng ở một scope thường thuộc `overrides/<Scope>/`.",
  "",
  "| Module JS | Số scope | Scope |",
  "|---|---|---|",
  ...[...byRef.entries()]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([ref, scopes]) => `| \`${ref}\` | ${scopes.size} | ${[...scopes].sort().join(", ")} |`),
  "",
  "## Theo scope",
  "",
];

for (const scope of [...byScope.keys()].sort()) {
  lines.push(`### ${scope}`, "", "| Nguồn | Khoá | Module JS |", "|---|---|---|");

  for (const entry of byScope.get(scope)) {
    lines.push(`| ${entry.source} | \`${entry.jsonPath}\` | \`${entry.ref}\` |`);
  }

  lines.push("");
}

await mkdir(path.dirname(outputFile), { recursive: true });
await writeFile(outputFile, lines.join("\n"));

console.log(`Wrote ${outputFile}: ${entries.length} refs, ${byRef.size} modules, ${byScope.size} scopes.`);
