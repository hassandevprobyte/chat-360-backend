'use strict';

const Joi = require('joi');
const {
  objectId,
  pageQuery,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const uploadAttachment = { params: workspaceParams };

const listAttachments = {
  params: workspaceParams,
  query: pageQuery.keys({ conversationId: objectId }),
};

const attachmentParams = { params: workspaceScopedParams('attachmentId') };

const publicAttachmentParams = { params: Joi.object({ attachmentId: objectId.required() }) };

module.exports = { uploadAttachment, listAttachments, attachmentParams, publicAttachmentParams };
