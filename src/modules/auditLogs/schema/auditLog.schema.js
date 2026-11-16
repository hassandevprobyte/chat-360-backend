'use strict';

const Joi = require('joi');
const { objectId, pageQuery, workspaceParams } = require('../../../common/validators/common.validators');

const listAuditLogs = {
  params: workspaceParams,
  query: pageQuery.keys({
    action: Joi.string().max(80),
    resource: Joi.string().max(40),
    actor: objectId,
    from: Joi.date().iso(),
    to: Joi.date().iso().min(Joi.ref('from')),
  }),
};

module.exports = { listAuditLogs };
