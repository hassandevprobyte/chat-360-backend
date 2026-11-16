'use strict';

const Joi = require('joi');
const {
  objectId,
  pageQuery,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const listVisitors = {
  params: workspaceParams,
  query: pageQuery.keys({
    websiteId: objectId,
    isOnline: Joi.boolean(),
    isIdentified: Joi.boolean(),
  }),
};

const visitorParams = { params: workspaceScopedParams('visitorId') };

module.exports = { listVisitors, visitorParams };
