const Boom = require("@hapi/boom");

// Repositories
const widgetRepository = require("./widget.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfWidgetDoesNotExist = async (widgetId) => {
  const widget = await widgetRepository.getWidgetById(widgetId);

  if (!widget) {
    throw Boom.notFound(message.error.widget.notFound);
  }

  return widget;
};
