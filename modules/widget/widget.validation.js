const Boom = require("@hapi/boom");

// Repositories
const widgetRepository = require("./widget.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfWidgetDoesNotExist = async (workspaceId, widgetId) => {
  const widget = await widgetRepository.getWidgetById(workspaceId, widgetId);

  if (!widget) {
    throw Boom.notFound(message.error.widget.notFound);
  }

  return widget;
};
