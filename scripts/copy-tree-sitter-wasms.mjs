import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const outDir = join(import.meta.dirname, "..", "dist", "tree-sitter-wasms");

const wasmFiles = [
  "tree-sitter-wasms/out/tree-sitter-typescript.wasm",
  "tree-sitter-wasms/out/tree-sitter-tsx.wasm",
  "tree-sitter-wasms/out/tree-sitter-javascript.wasm",
];

await mkdir(outDir, { recursive: true });

for (const specifier of wasmFiles) {
  const sourcePath = require.resolve(specifier);
  const targetPath = join(outDir, specifier.split("/").at(-1));
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(sourcePath, targetPath);
}
