// Services
const visitorService = require("../visitor/visitor.service");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./public.schema");
const websiteValidation = require("../website/website.validation");

// Helpers
const widgetHelpers = require("../widget/widget.helper");
const visitortHelpers = require("../visitor/visitor.helper");

exports.createVisitor = async (publicKey, payload, req) => {
  const validatedPayload = joi.validate(payload, joiSchema.createVisitor);

  const { widget, website, workspace } = await widgetHelpers.resolveByPublicKey(publicKey);

  widgetHelpers.assertOriginAllowed(website, req);

  const visitorPayload = {
    ...validatedPayload,
    workspace: workspace._id,
    website: website._id,
    widget: widget._id,
  };

  const visitor = await visitorService.createVisitor(visitorPayload);

  const visitorToken = visitortHelpers.signVisitorToken({
    visitorId: visitor._id,
    workspaceId: workspace._id,
    websiteId: website._id,
    widgetId: widget._id,
    anonymousId: visitor.anonymousId,
  });

  const active = await conversationRepository.findActiveForVisitor(workspace._id, visitor._id);

  return {
    visitorToken,
    visitor: serializeSelfVisitor(visitor),
    activeConversation: active ? await visitorConversationPayload(workspace._id, active) : null,
  };
};
