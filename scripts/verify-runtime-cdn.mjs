import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeLibraries = JSON.parse(
  readFileSync(resolve(projectRoot, "scripts/userscript-runtime.json"), "utf8"),
);
const sha256 = (content) =>
  createHash("sha256").update(content).digest("base64");

const results = await Promise.all(
  runtimeLibraries.map(async (library) => {
    const localContent = readFileSync(resolve(projectRoot, library.file));
    const response = await fetch(library.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${library.url} returned HTTP ${response.status}`);
    }

    const remoteContent = Buffer.from(await response.arrayBuffer());
    const localDigest = sha256(localContent);
    const remoteDigest = sha256(remoteContent);
    if (remoteDigest !== localDigest) {
      throw new Error(
        `${library.module} hash mismatch: local ${localDigest}, remote ${remoteDigest}`,
      );
    }

    return `${library.module}: sha256=${remoteDigest}`;
  }),
);

console.log(`[runtime CDN verification] passed (${results.length} files)`);
for (const result of results) console.log(`- ${result}`);
