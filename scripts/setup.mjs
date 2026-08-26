import { generateKeyPairSync } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";

const [, , command, targetDir] = process.argv;

function makeCerts(dir) {
  const outDir = path.resolve(dir);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const privateKeyPath = path.join(outDir, "private-key.pem");
  const publicKeyPath = path.join(outDir, "public-key.pem");

  if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
    console.log(`[setup] RS256 keypair already present in ${outDir}, skipping.`);
    return;
  }

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  writeFileSync(privateKeyPath, privateKey);
  writeFileSync(publicKeyPath, publicKey);
  console.log(`[setup] Generated RS256 keypair in ${outDir}`);
}

switch (command) {
  case "make:certs":
    makeCerts(targetDir || "./src/core/.certs");
    break;
  default:
    console.error(`[setup] Unknown command: ${command}`);
    process.exit(1);
}
