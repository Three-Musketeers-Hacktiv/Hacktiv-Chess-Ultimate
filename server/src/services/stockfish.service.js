const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const readline = require("node:readline");

const MAX_ACTIVE = 2;
const MAX_WAITING = 5;
const SEARCH_TIME_MS = 1000;
const ANALYSIS_SEARCH_TIME_MS = 75;
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

function parseUciScore(line, fen) {
  const match = /\bscore (cp|mate) (-?\d+)(?:\s|$)/.exec(String(line));
  if (!match) return null;
  const sideToMove = fen.split(" ")[1];
  const sign = sideToMove === "w" ? 1 : -1;
  return match[1] === "cp"
    ? { cp: Number(match[2]) * sign, mate: null }
    : { cp: null, mate: (Number(match[2]) || -1) * sign };
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

function runAnalysisEngine(fens) {
  return new Promise((resolve, reject) => {
    const executable = enginePath();
    if (!executable || !isAvailable()) return reject(new Error("Stockfish executable is unavailable."));

    let settled = false;
    let uciReady = false;
    let index = -1;
    let currentScore = null;
    let currentMove = null;
    const evaluations = [];
    const child = spawn(executable, [], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
    const lines = readline.createInterface({ input: child.stdout });
    const timeout = setTimeout(() => finish(new Error("Stockfish analysis timed out.")), 15_000);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      lines.close();
      if (child.exitCode === null) {
        try { child.stdin.write("quit\n"); } catch { /* process may already be closing */ }
        child.kill();
      }
      if (error) reject(error);
      else resolve(result);
    }

    function searchNextPosition() {
      index += 1;
      if (index >= fens.length) return finish(null, evaluations);
      currentScore = null;
      currentMove = null;
      child.stdin.write(`position fen ${fens[index]}\n`);
      child.stdin.write(`go movetime ${ANALYSIS_SEARCH_TIME_MS}\n`);
    }

    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (!settled) finish(new Error(`Stockfish exited before completing analysis (code ${code}).`));
    });
    lines.on("line", (line) => {
      if (line === "uciok" && !uciReady) {
        uciReady = true;
        child.stdin.write("setoption name Threads value 1\n");
        child.stdin.write("isready\n");
      } else if (line === "readyok" && index === -1) {
        searchNextPosition();
      } else if (index >= 0 && line.startsWith("info ")) {
        const score = parseUciScore(line, fens[index]);
        if (score) currentScore = score;
      } else if (index >= 0 && line.startsWith("bestmove ")) {
        currentMove = parseBestMove(line);
        if (!currentScore) return finish(new Error("Stockfish returned no evaluation score."));
        evaluations.push({ score: currentScore, best_move: currentMove });
        searchNextPosition();
      }
    });
    child.stdin.write("uci\n");
  });
}

function pump() {
  while (active < MAX_ACTIVE && queue.length) {
    const job = queue.shift();
    if (job.cancelled) continue;
    clearTimeout(job.waitTimer);
    active += 1;
    Promise.resolve().then(job.execute)
      .then(job.resolve, job.reject)
      .finally(() => {
        active -= 1;
        pump();
      });
  }
}

function createReservation() {
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
    submit(execute, waitTimeoutMs = 0) {
      if (consumed) throw new Error("Stockfish reservation has already been used.");
      consumed = true;
      reserved -= 1;
      return new Promise((resolve, reject) => {
        const job = { execute, resolve, reject, cancelled: false, waitTimer: null };
        if (waitTimeoutMs > 0) {
          job.waitTimer = setTimeout(() => {
            const queuedIndex = queue.indexOf(job);
            if (queuedIndex < 0) return;
            job.cancelled = true;
            queue.splice(queuedIndex, 1);
            const error = new Error("Antrean Stockfish terlalu lama. Coba lagi sebentar.");
            error.status = 503;
            error.code = "ENGINE_BUSY";
            reject(error);
            pump();
          }, waitTimeoutMs);
          job.waitTimer.unref?.();
        }
        queue.push(job);
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

function reserveBotMove() {
  const reservation = createReservation();
  return {
    run: (fen, difficulty) => reservation.submit(() => runEngine(fen, difficulty)),
    release: reservation.release,
  };
}

function reserveAnalysis() {
  const reservation = createReservation();
  return {
    run: (fens) => reservation.submit(() => runAnalysisEngine(fens), 10_000),
    release: reservation.release,
  };
}

module.exports = { isAvailable, parseBestMove, parseUciScore, reserveBotMove, reserveAnalysis, SKILL_LEVELS };
