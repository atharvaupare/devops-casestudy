const { Router } = require("express");
const { auth } = require("../middlewares/auth");
const {
  shortenUrl,
  redirectUrl,
  getAnalytics,
  updateAlias,
  deleteAlias,
} = require("../controllers/url.controller");

const router = Router();

router.post("/shorten", auth, shortenUrl);
router.get("/:alias", redirectUrl);
router.get("/analytics/:alias", auth, getAnalytics);
router.put("/update/:alias", auth, updateAlias);
router.delete("/delete/:alias", auth, deleteAlias);
module.exports = router;
