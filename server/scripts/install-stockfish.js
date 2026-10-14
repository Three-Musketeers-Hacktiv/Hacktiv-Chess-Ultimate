const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const VERSION = "sf_19";
const TARGET = path.resolve(__dirname, "..", ".stockfish", "stockfish");

async function main() {
  if (process.platform !== "linux" || process.arch !== "x64") {
    console.log("[stockfish] automatic install skipped; supported build platform is Linux x64.");
    return;
  }

  const response = await fetch(`https://api.github.com/repos/official-stockfish/Stockfish/releases/tags/${VERSION}`, {
    headers: { "User-Agent": "hacktiv-chess-server", Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`GitHub release lookup failed: HTTP ${response.status}`);

  const release = await response.json();
  const asset = release.assets.find(({ name }) => /^stockfish-(?:ubuntu|linux)-x86-64\.tar$/i.test(name));
  if (!asset) throw new Error(`No Linux x64 Stockfish archive found in release ${VERSION}.`);
  if (!asset.digest?.startsWith("sha256:")) throw new Error("GitHub release did not provide a SHA-256 digest for the Stockfish archive.");

  const download = await fetch(asset.browser_download_url, { headers: { "User-Agent": "hacktiv-chess-server" } });
  if (!download.ok) throw new Error(`Stockfish download failed: HTTP ${download.status}`);
  const archive = Buffer.from(await download.arrayBuffer());
  const digest = `sha256:${crypto.createHash("sha256").update(archive).digest("hex")}`;
  if (digest !== asset.digest) throw new Error("Stockfish archive SHA-256 verification failed.");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stockfish-"));
  try {
    const archivePath = path.join(tempDir, asset.name);
    fs.writeFileSync(archivePath, archive);
    const extraction = spawnSync("tar", ["-xf", archivePath, "-C", tempDir], { encoding: "utf8" });
    if (extraction.error || extraction.status !== 0) {
      throw extraction.error || new Error(`Unable to extract Stockfish archive: ${extraction.stderr}`);
    }

    const executable = findExecutable(tempDir);
    if (!executable) throw new Error("Stockfish executable was not found in the release archive.");
    fs.mkdirSync(path.dirname(TARGET), { recursive: true });
    fs.copyFileSync(executable, TARGET);
    fs.chmodSync(TARGET, 0o755);
    console.log(`[stockfish] installed ${VERSION} at ${TARGET}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function findExecutable(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = findExecutable(candidate);
      if (nested) return nested;
    } else if (entry.isFile() && /^stockfish(?:-ubuntu-x86-64)?$/i.test(entry.name)) {
      return candidate;
    }
  }
  return null;
}

main().catch((error) => {
  console.error(`[stockfish] automatic install failed: ${error.message}`);
  process.exitCode = 1;
});
