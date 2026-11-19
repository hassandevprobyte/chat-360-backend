const express = require("express");
const router = express.Router();

// Controllers
const tagController = require("./tag.controller");

router.route("/").get(tagController.getTagsWithPagination).post(tagController.createTag);
router.route("/all").get(tagController.getAllTags);
router.route("/:id").get(tagController.getTagById).patch(tagController.updateTag).delete(tagController.deleteTag);

module.exports = router;
