const { Router } = require("express");
const authenticate = require("../middleware/auth");
const controller = require("../controllers/game.controller");

const router = Router();
router.use(authenticate);
// Ranked (Elo ±200) or casual PvP queue. Leaving the queue stays `DELETE /api/games/:id/matchmaking`.
router.post("/join", controller.joinMatchmaking);

module.exports = router;
