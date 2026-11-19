const express = require("express");
const router = express.Router();

// Controllers
const widgetController = require("./widget.controller");

router.route("/").get(widgetController.getWidgetsWithPagination).post(widgetController.createWidget);
router.route("/all").get(widgetController.getAllWidgets);
router.route("/:id").get(widgetController.getWidgetById).patch(widgetController.updateWidget).delete(widgetController.deleteWidget);

module.exports = router;
