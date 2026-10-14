const { Router } = require("express");
const { login, register } = require("../controllers/auth.controller");
const createAuthRateLimit = require("../middleware/auth-rate-limit");

const router = Router();
const registerLimit = createAuthRateLimit(5, 15 * 60 * 1000);
const loginLimit = createAuthRateLimit(10, 15 * 60 * 1000);

router.post("/register", registerLimit, register);
router.post("/login", loginLimit, login);

module.exports = router;
