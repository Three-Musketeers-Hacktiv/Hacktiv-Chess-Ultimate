"use strict";

const { Op } = require("sequelize");
const { Puzzle, sequelize } = require("../models");

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const present = (puzzle) => ({
  id: puzzle.id,
  fen: puzzle.fen,
  solution: puzzle.solution,
  difficulty: puzzle.difficulty,
  description: puzzle.description,
});

const pickRandom = (difficulty, excludeId) => {
  const where = { difficulty };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return Puzzle.findOne({ where, order: sequelize.random() });
};

const randomPuzzle = async (request, response, next) => {
  try {
    const difficulty = String(request.query.difficulty || "easy").trim().toLowerCase();
    if (!DIFFICULTIES.has(difficulty)) {
      return response.status(400).json({
        status: "error",
        message: "Difficulty harus easy, medium, atau hard.",
      });
    }

    const exclude = String(request.query.exclude || "");
    const excludeId = UUID_RE.test(exclude) ? exclude : null;
    let puzzle = await pickRandom(difficulty, excludeId);
    if (!puzzle && excludeId) puzzle = await pickRandom(difficulty, null);

    if (!puzzle) {
      return response.status(404).json({
        status: "error",
        message: "Tidak ada puzzle untuk tingkat kesulitan ini.",
      });
    }

    return response.status(200).json({ status: "success", puzzle: present(puzzle) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { randomPuzzle };
