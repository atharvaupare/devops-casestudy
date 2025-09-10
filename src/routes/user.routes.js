const { Router } = require("express");
const { listUsers, createUser, deleteUser } = require("../controllers/user.controller");
const { auth } = require("../middlewares/auth");
const router = Router();

router.get("/", auth, listUsers);
router.post("/", auth, createUser);
router.delete("/:id", auth, deleteUser);

module.exports = router;