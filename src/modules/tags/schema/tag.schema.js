'use strict';

const Joi = require('joi');
const {
  hexColor,
  pageQuery,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const createTag = {
  params: workspaceParams,
  body: Joi.object({
    name: Joi.string().trim().min(1).max(40).required(),
    color: hexColor.default('#64748b'),
    description: Joi.string().trim().max(200).allow('', null),
  }),
};

const listTags = {
  params: workspaceParams,
  query: pageQuery.keys({ isActive: Joi.boolean() }),
};

const tagParams = { params: workspaceScopedParams('tagId') };

const updateTag = {
  params: workspaceScopedParams('tagId'),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(40),
    color: hexColor,
    description: Joi.string().trim().max(200).allow('', null),
    isActive: Joi.boolean(),
  }).min(1),
};

module.exports = { createTag, listTags, tagParams, updateTag };
