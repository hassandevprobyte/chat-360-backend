'use strict';

const Joi = require('joi');
const { NOTIFICATION_TYPES } = require('../../../common/constants');
const { objectId, cursorQuery, idParam } = require('../../../common/validators/common.validators');

const listNotifications = {
  query: cursorQuery.keys({
    workspaceId: objectId,
    unreadOnly: Joi.boolean().default(false),
    type: Joi.string().valid(...Object.values(NOTIFICATION_TYPES)),
  }),
};

const unreadCount = { query: Joi.object({ workspaceId: objectId }) };

const markRead = { params: idParam('id') };

const markAllRead = { body: Joi.object({ workspaceId: objectId }) };

module.exports = { listNotifications, unreadCount, markRead, markAllRead };
