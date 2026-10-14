const { Router } = require("express");
const authenticate = require("../middleware/auth");
const controller = require("../controllers/game.controller");

const router = Router();
router.use(authenticate);
// PGN review with Stockfish. (Stored games are analysed by id: `POST /api/games/:id/analysis`.)
router.post("/analyze", controller.analyzePgn);

module.exports = router;
