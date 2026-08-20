import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projectFile = (relativePath) => resolve(projectRoot, relativePath);
const readProjectFile = (relativePath) =>
  readFileSync(projectFile(relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readProjectFile(relativePath));

const packageJson = readJson("package.json");
const runtimeLibraries = readJson("scripts/userscript-runtime.json");
const thirdPartyNotices = readProjectFile("THIRD_PARTY_NOTICES.txt")
  .replace(/\r\n?/g, "\n")
  .trim();
const userscriptPath = projectFile("dist/bilibili-music-player.user.js");
const metadataPath = projectFile("dist/bilibili-music-player.meta.js");
const userscript = readFileSync(userscriptPath, "utf8");
const metadata = readFileSync(metadataPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[userscript audit] ${message}`);
  }
}

function sha256(relativePath) {
  return createHash("sha256")
    .update(readFileSync(projectFile(relativePath)))
    .digest("base64");
}

function metadataValues(source, key) {
  const expression = new RegExp(`^//\\s+@${key}\\s+(.+?)\\s*$`, "gm");
  return [...source.matchAll(expression)].map((match) => match[1]);
}

const expectedRequires = runtimeLibraries.map(
  (library) => `${library.url}#sha256=${sha256(library.file)}`,
);
const requiredRuntimeOrder = [
  "preact",
  "preact/hooks",
  "preact/jsx-runtime",
  "@preact/signals-core",
  "@preact/signals",
];
assert(
  JSON.stringify(runtimeLibraries.map((library) => library.module)) ===
    JSON.stringify(requiredRuntimeOrder),
  "runtime manifest is not in dependency order",
);

for (const source of [userscript, metadata]) {
  assert(
    JSON.stringify(metadataValues(source, "require")) ===
      JSON.stringify(expectedRequires),
    "@require entries must use the declared order, exact versions, and local SHA-256 digests",
  );
  assert(
    metadataValues(source, "match").join() ===
      "https://www.bilibili.com/video/*",
    "the userscript must remain limited to Bilibili /video/ pages",
  );
  assert(
    metadataValues(source, "version").join() === packageJson.version,
    "userscript and package versions must match",
  );
  assert(
    metadataValues(source, "license").join() === "MIT",
    "userscript metadata must declare the project MIT license",
  );
}

for (const library of runtimeLibraries) {
  assert(
    packageJson.dependencies[library.package] === library.version,
    `${library.package} must be a direct dependency pinned to ${library.version}`,
  );
  assert(
    new RegExp(
      `/npm/${library.package.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}@${library.version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`,
    ).test(library.url),
    `${library.module} must use an exact-version jsDelivr URL`,
  );
}

assert(
  !("lucide-preact" in packageJson.dependencies),
  "lucide-preact must not be bundled as a dependency",
);
assert(
  statSync(userscriptPath).size <= 2 * 1024 * 1024,
  "userscript exceeds Greasy Fork's 2 MB size limit",
);

const requiredNotices = [
  "Copyright (c) 2015-present Jason Miller",
  "Copyright (c) 2022-present Preact Team",
  "Copyright (c) 2026 Lucide Icons and Contributors",
  "Copyright (c) 2013-present Cole Bemis",
];
for (const notice of requiredNotices) {
  assert(userscript.includes(notice), `missing third-party notice: ${notice}`);
}

const embeddedNoticeMatch = userscript.match(
  /\/\*!\r?\n([\s\S]*?)\r?\n\s*\*\//,
);
const embeddedNotices = embeddedNoticeMatch?.[1]
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*\* ?/, ""))
  .join("\n")
  .trim();
assert(
  embeddedNotices === thirdPartyNotices,
  "the complete THIRD_PARTY_NOTICES.txt text must be embedded near the top",
);

const longestLine = userscript
  .split(/\r?\n/)
  .reduce((longest, line) => Math.max(longest, line.length), 0);
assert(
  longestLine <= 1_000,
  `found a ${longestLine}-character line; output appears compressed`,
);

for (const name of [
  "installAudioOnlyInterceptors",
  "rewritePlayurlPayload",
  "PlayerEngine",
]) {
  assert(
    userscript.includes(name),
    `readable business symbol was lost: ${name}`,
  );
}

const forbiddenRuntimeMarkers = [
  "createLucideIcon",
  "__PREACT_DEVTOOLS__",
  "__PREACT_SIGNALS_DEVTOOLS__",
  "ReactiveTextNode",
];
for (const marker of forbiddenRuntimeMarkers) {
  assert(
    !userscript.includes(marker),
    `bundled framework/icon runtime marker found: ${marker}`,
  );
}

const forbiddenDynamicCode = [
  [/(^|[^\w])eval\s*\(/, "eval"],
  [/\bnew\s+Function\s*\(/, "new Function"],
  [/createElement\s*\(\s*["']script["']/, "dynamic script element"],
];
for (const [pattern, label] of forbiddenDynamicCode) {
  assert(!pattern.test(userscript), `${label} is not allowed in the build`);
}

assert(
  userscript.includes('"#bilibili-music-player-root {"') &&
    userscript.includes('].join("\\n")'),
  "embedded CSS is not in readable, non-minified form",
);

console.log(
  `[userscript audit] passed: ${runtimeLibraries.length} pinned runtimes, ${statSync(userscriptPath).size} bytes, longest line ${longestLine}`,
);
