const { Router } = require("express");
const authenticate = require("../middleware/auth");
const controller = require("../controllers/game.controller");

const router = Router();
router.use(authenticate);
router.post("/", controller.createGame);
router.get("/open", controller.listOpen);
router.get("/live", controller.listLive);
router.post("/:id/join", controller.joinGame);
router.post("/:id/moves", controller.makeMove);
router.post("/:id/resign", controller.resign);
router.post("/:id/draw-offers", controller.offerDraw);
router.post("/:id/draw-offers/response", controller.respondDraw);
router.post("/:id/draw-claims", controller.claimDraw);
router.get("/:id", controller.getGame);

module.exports = router;
