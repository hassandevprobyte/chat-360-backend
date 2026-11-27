const Boom = require("@hapi/boom");

// Repositories
const widgetRepository = require("./widget.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfWidgetDoesNotExistInContextOfWorkspace = async (widgetId, workspaceId) => {
  const widget = await widgetRepository.getWidgetByIdAndWorkspaceId(widgetId, workspaceId);

  if (!widget) {
    throw Boom.notFound(message.error.widget.notFound);
  }

  return widget;
};

exports.throwErrorIfWidgetPublicKeyDoesNotExist = async (publicKey) => {
  const widget = await widgetRepository.getWidgetByPublicKey(publicKey);

  if (!widget) {
    throw Boom.notFound(message.error.widget.notFound);
  }

  return widget;
};

exports.throwErrorIfWidgetDoesNotExistInContextOfWorkspaceAndWebsite = async (widgetId, workspaceId, websiteId) => {
  const widget = await widgetRepository.getWidgetInContextOfWorkspaceAndWebsite(widgetId, workspaceId, websiteId);

  if (!widget) {
    throw Boom.notFound(message.error.widget.notFound);
  }

  return widget;
};
