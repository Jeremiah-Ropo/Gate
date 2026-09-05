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

// Ed25519 key pair for signing ticket QR payloads.
//
// Deliberately prints instead of writing. Overwriting this pair invalidates every ticket
// ever issued -- the old public key can no longer verify them -- so rotating it has to be
// a decision someone makes, not a side effect of running a setup script. `make:certs`
// writes files because a JWT key pair can be regenerated at will; this one cannot.
function makeTicketKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Base64 so the value survives an environment variable. Raw PEM contains newlines, which
  // shells, CI, and secret managers each escape differently, and the resulting failure
  // looks like a corrupt key rather than a quoting mistake.
  const encode = (pem) => Buffer.from(pem, "utf8").toString("base64");

  console.log("[setup] Ed25519 ticket signing key pair generated.");
  console.log("[setup] Add these to your .env. Do not commit them, and do not regenerate");
  console.log("[setup] them for an environment that has already issued tickets.\n");
  console.log(`PRIVATE_CHECKIN_KEY=${encode(privateKey)}`);
  console.log(`PUBLIC_CHECKIN_KEY=${encode(publicKey)}`);
}

switch (command) {
  case "make:certs":
    makeCerts(targetDir || "./src/core/.certs");
    break;
  case "make:ticket-keys":
    makeTicketKeys();
    break;
  default:
    console.error(`[setup] Unknown command: ${command}`);
    process.exit(1);
}
