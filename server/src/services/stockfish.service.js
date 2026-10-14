const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const readline = require("node:readline");

const MAX_ACTIVE = 2;
const MAX_WAITING = 5;
const SEARCH_TIME_MS = 1000;
const SKILL_LEVELS = Object.freeze({ easy: 0, medium: 5, hard: 10 });

let active = 0;
let reserved = 0;
const queue = [];

function enginePath() {
  const configured = process.env.STOCKFISH_PATH?.trim();
  return configured ? path.resolve(configured) : null;
}

function isAvailable() {
  const executable = enginePath();
  if (!executable) return false;
  try {
    fs.accessSync(executable, process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function parseBestMove(line) {
  const match = /^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/.exec(String(line).trim());
  return match?.[1] ?? null;
}

function runEngine(fen, difficulty) {
  return new Promise((resolve, reject) => {
    const executable = enginePath();
    if (!executable || !isAvailable()) return reject(new Error("Stockfish executable is unavailable."));

    let settled = false;
    let uciReady = false;
    let ready = false;
    let searching = false;
    const child = spawn(executable, [], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    const lines = readline.createInterface({ input: child.stdout });
    const timeout = setTimeout(() => finish(new Error("Stockfish search timed out.")), SEARCH_TIME_MS + 5000);

    function finish(error, move) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      lines.close();
      if (child.exitCode === null) {
        try { child.stdin.write("quit\n"); } catch { /* process may already be closing */ }
        child.kill();
      }
      if (error) reject(error);
      else resolve(move);
    }

    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (!settled) finish(new Error(`Stockfish exited before returning a move (code ${code}).`));
    });
    lines.on("line", (line) => {
      if (line === "uciok" && !uciReady) {
        uciReady = true;
        child.stdin.write("setoption name Threads value 1\n");
        child.stdin.write(`setoption name Skill Level value ${SKILL_LEVELS[difficulty]}\n`);
        child.stdin.write("isready\n");
      } else if (line === "readyok" && !ready) {
        ready = true;
        child.stdin.write(`position fen ${fen}\n`);
        child.stdin.write(`go movetime ${SEARCH_TIME_MS}\n`);
        searching = true;
      } else if (searching && line.startsWith("bestmove ")) {
        const move = parseBestMove(line);
        if (!move) finish(new Error("Stockfish returned no legal move."));
        else finish(null, move);
      }
    });
    child.stdin.write("uci\n");
  });
}

function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    const job = queue.shift();
    active += 1;
    runEngine(job.fen, job.difficulty)
      .then(job.resolve, job.reject)
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}

function reserveBotMove() {
  if (!isAvailable()) {
    const error = new Error("Stockfish belum tersedia. Periksa STOCKFISH_PATH.");
    error.status = 503;
    error.code = "ENGINE_UNAVAILABLE";
    throw error;
  }
  if (active + queue.length + reserved >= MAX_ACTIVE + MAX_WAITING) {
    const error = new Error("Antrean bot sedang penuh. Coba lagi sebentar.");
    error.status = 503;
    error.code = "ENGINE_BUSY";
    throw error;
  }

  reserved += 1;
  let consumed = false;
  return {
    run(fen, difficulty) {
      if (consumed) throw new Error("Stockfish reservation has already been used.");
      consumed = true;
      reserved -= 1;
      return new Promise((resolve, reject) => {
        queue.push({ fen, difficulty, resolve, reject });
        pump();
      });
    },
    release() {
      if (!consumed) {
        consumed = true;
        reserved -= 1;
      }
    },
  };
}

module.exports = { isAvailable, parseBestMove, reserveBotMove, SKILL_LEVELS };
