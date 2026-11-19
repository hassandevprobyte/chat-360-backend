const express = require("express");
const router = express.Router();

// Controllers
const websiteController = require("./website.controller");

router.route("/").get(websiteController.getWebsitesWithPagination).post(websiteController.createWebsite);
router.route("/all").get(websiteController.getAllWebsites);
router.route("/:id").get(websiteController.getWebsiteById).patch(websiteController.updateWebsite).delete(websiteController.deleteWebsite);

module.exports = router;
