const asyncHandler = require("express-async-handler");

// Services
const pulicService = require("./public.service");

// @desc    Create a new Visitor
// @route   POST /api/v1/visitors
// @access  public
exports.createVisitor = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
  };

  const data = await pulicService.createVisitor(req.params.publicKey, payload, req);

  res.status(201).json(data);
});
