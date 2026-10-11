// Committed static output lets the Python-only Docker image run without Node or a CDN.
import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const frontend = fileURLToPath(new URL("../", import.meta.url));
const output = path.resolve(frontend, "../backend/articles/static/articles");
await mkdir(output, { recursive: true });
const result = await build({ entryPoints: [path.join(frontend, "scripts/admin-article-editor.ts")], outfile: path.join(output, "article-editor.js"), bundle: true, minify: true, format: "iife", target: ["es2020"], legalComments: "eof", metafile: true });
await copyFile(path.join(frontend, "src/styles/article-content.css"), path.join(output, "article-editor.css"));
const names = [...new Set(Object.keys(result.metafile.inputs).flatMap(input => {
  const match = input.replaceAll("\\", "/").match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  return match ? [match[1]] : [];
}))].sort();
let licenses = "Self-hosted article editor. Rebuild: cd frontend && npm run build:admin-editor\n\n";
for (const name of names) {
  const dir = path.join(frontend, "node_modules", name);
  const license = (await readdir(dir)).find(file => /^license(?:\.|$)/i.test(file));
  if (license) licenses += `=== ${name} ===\n${await readFile(path.join(dir, license), "utf8")}\n\n`;
}
await writeFile(path.join(output, "THIRD_PARTY_LICENSES.txt"), licenses);
