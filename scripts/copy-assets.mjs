import { cpSync, existsSync } from "fs";

const assetDirs = [
  ["src/core/.certs", "dist/core/.certs"],
  ["uploads", "dist/uploads"],
  ["src/Modules/Event/public", "dist/Modules/Event/public"],
];

for (const [from, to] of assetDirs) {
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`[copy-assets] ${from} -> ${to}`);
  }
}
