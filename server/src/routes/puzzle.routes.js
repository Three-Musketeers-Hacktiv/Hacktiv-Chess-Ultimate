const { Router } = require("express");
const authenticate = require("../middleware/auth");
const { randomPuzzle } = require("../controllers/puzzle.controller");

const router = Router();

router.use(authenticate);
router.get("/random", randomPuzzle);

module.exports = router;
