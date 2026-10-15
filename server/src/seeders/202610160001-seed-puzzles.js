"use strict";

/** Legal lines checked with chess.js. `solution` is the full line, solver move first. */
const PUZZLES = [
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000001",
    fen: "6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1",
    solution: ["e1e8"],
    difficulty: "easy",
    description: "Back-rank mate. Slide the rook to the eighth rank.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000002",
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    solution: ["h5f7"],
    difficulty: "easy",
    description: "Mate in one. The queen and the bishop meet on f7.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000003",
    fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
    solution: ["f7g7"],
    difficulty: "easy",
    description: "The queen steps beside the king, and your king protects her.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000004",
    fen: "rnb1kbnr/pppp1ppp/8/8/3qP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 1 3",
    solution: ["f3d4"],
    difficulty: "easy",
    description: "The queen on d4 is loose. Take it with the knight.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000011",
    fen: "4k3/8/8/8/2q1N3/8/8/4K3 w - - 0 1",
    solution: ["e4d6"],
    difficulty: "medium",
    description: "The knight forks the king on e8 and the queen on c4.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000012",
    fen: "r3k3/8/4N3/8/8/8/8/4K3 w - - 0 1",
    solution: ["e6c7"],
    difficulty: "medium",
    description: "Jump to c7. The king and the rook on a8 are both under attack.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000013",
    fen: "r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
    solution: ["d5c7"],
    difficulty: "medium",
    description: "Another knight fork: c7 hits the king and the rook.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000014",
    fen: "8/8/3n1b2/4P3/8/8/8/4K2k w - - 0 1",
    solution: ["e5e6"],
    difficulty: "medium",
    description: "Push the pawn. It forks the knight on d6 and the bishop on f6.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000021",
    fen: "2k5/8/2K5/8/8/8/8/Q7 w - - 0 1",
    solution: ["a1a7", "c8d8", "a7d7"],
    difficulty: "hard",
    description: "Queen and king. Drive the king to d8, then finish on d7.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000022",
    fen: "k7/8/2K5/8/8/8/8/Q7 w - - 0 1",
    solution: ["c6b6", "a8b8", "a1h8"],
    difficulty: "hard",
    description: "Check with the king, then swing the queen to h8.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000023",
    fen: "6k1/8/6K1/8/8/8/8/6Q1 w - - 0 1",
    solution: ["g1f2", "g8h8", "f2f8"],
    difficulty: "hard",
    description: "Quiet queen move. After the king steps to h8, Qf8 is mate.",
  },
  {
    id: "a1b2c3d4-e5f6-4789-a012-000000000024",
    fen: "1k6/8/1K6/8/8/8/8/Q7 w - - 0 1",
    solution: ["b6c6", "b8c8", "a1a8"],
    difficulty: "hard",
    description: "Walk the king to c6, then bring the queen to a8.",
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "puzzles",
      PUZZLES.map((puzzle) => ({
        ...puzzle,
        solution: JSON.stringify(puzzle.solution),
        created_at: now,
      })),
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("puzzles", {
      id: PUZZLES.map((puzzle) => puzzle.id),
    });
  },
};
