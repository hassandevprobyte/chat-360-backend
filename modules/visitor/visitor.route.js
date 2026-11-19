const express = require("express");
const router = express.Router();

// Controllers
const visitorController = require("./visitor.controller");

router.route("/").get(visitorController.getVisitorsWithPagination).post(visitorController.createVisitor);
router.route("/all").get(visitorController.getAllVisitors);
router.route("/:id").get(visitorController.getVisitorById).patch(visitorController.updateVisitor).delete(visitorController.deleteVisitor);

module.exports = router;
