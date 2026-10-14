const { Router } = require("express");
const authenticate = require("../middleware/auth");
const controller = require("../controllers/game.controller");

const router = Router();
router.use(authenticate);
router.param("id", (_request, response, next, id) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return response.status(400).json({ status: "error", code: "INVALID_GAME_ID", message: "ID game tidak valid." });
  }
  return next();
});
router.post("/", controller.createGame);
router.get("/", controller.listHistory);
router.get("/live", controller.listLive);
router.delete("/:id/matchmaking", controller.cancelMatchmaking);
router.post("/:id/moves", controller.makeMove);
router.post("/:id/resign", controller.resign);
router.post("/:id/draw-offers", controller.offerDraw);
router.post("/:id/draw-offers/response", controller.respondDraw);
router.post("/:id/draw-claims", controller.claimDraw);
router.get("/:id", controller.getGame);

module.exports = router;
