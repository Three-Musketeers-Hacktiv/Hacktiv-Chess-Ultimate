const { Router } = require("express");
const authenticate = require("../middleware/auth");
const { updateUsername } = require("../controllers/user.controller");

const router = Router();
router.use(authenticate);
router.put("/update-username", updateUsername);

module.exports = router;
