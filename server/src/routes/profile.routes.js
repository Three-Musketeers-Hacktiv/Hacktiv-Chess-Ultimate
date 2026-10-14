const { Router } = require("express");
const authenticate = require("../middleware/auth");
const { getMyProfile } = require("../controllers/profile.controller");

const router = Router();
router.use(authenticate);
router.get("/me", getMyProfile);

module.exports = router;
