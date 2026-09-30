// Tải spec OpenAPI từ Espo (GET /OpenApi, cần tài khoản admin) vào types/espo/openapi.json.
// Chạy qua `npm run gen:api-types`, script đó sinh tiếp types/espo/openapi.d.ts.
import { mkdir, writeFile } from "node:fs/promises";

const espoUrl = process.env.ESPO_URL?.replace(/\/+$/, "");
const apiUrl = process.env.ESPO_API_URL?.replace(/\/+$/, "") || `${espoUrl}/api/v1`;
const username = process.env.ESPO_ADMIN_USERNAME;
const password = process.env.ESPO_ADMIN_PASSWORD;

if (!espoUrl || !username || !password) {
  console.error("Need ESPO_URL, ESPO_ADMIN_USERNAME and ESPO_ADMIN_PASSWORD in .env.local (see .env.example).");
  process.exit(1);
}

const auth = Buffer.from(`${username}:${password}`).toString("base64");

const response = await fetch(`${apiUrl}/OpenApi`, {
  headers: {
    Authorization: `Basic ${auth}`,
    "Espo-Authorization": auth,
  },
});

if (!response.ok) {
  const reason = response.headers.get("x-status-reason");
  console.error(`GET ${apiUrl}/OpenApi -> ${response.status}${reason ? ` (${reason})` : ""}`);
  process.exit(1);
}

const spec = await response.json();

await mkdir("types/espo", { recursive: true });
await writeFile("types/espo/openapi.json", JSON.stringify(spec, null, 2) + "\n");

console.log(`Saved types/espo/openapi.json (${Object.keys(spec.paths ?? {}).length} paths).`);
