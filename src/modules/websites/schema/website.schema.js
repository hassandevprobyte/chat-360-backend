'use strict';

const Joi = require('joi');
const { WEBSITE_STATUS, VERIFICATION_METHODS } = require('../../../common/constants');
const {
  name,
  domain,
  pageQuery,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const settings = Joi.object({
  enforceOriginCheck: Joi.boolean(),
  collectVisitorLocation: Joi.boolean(),
});

const createWebsite = {
  params: workspaceParams,
  body: Joi.object({
    name: name.required(),
    domain: domain.required(),
    allowedDomains: Joi.array().items(domain).max(20).default([]),
    settings,
  }),
};

const listWebsites = {
  params: workspaceParams,
  query: pageQuery.keys({ status: Joi.string().valid(...Object.values(WEBSITE_STATUS)) }),
};

const websiteParams = { params: workspaceScopedParams('websiteId') };

const updateWebsite = {
  params: workspaceScopedParams('websiteId'),
  body: Joi.object({
    name,
    domain,
    allowedDomains: Joi.array().items(domain).max(20),
    status: Joi.string().valid(...Object.values(WEBSITE_STATUS)),
    settings,
  }).min(1),
};

const verifyWebsite = {
  params: workspaceScopedParams('websiteId'),
  body: Joi.object({
    method: Joi.string().valid(...Object.values(VERIFICATION_METHODS)).required(),
  }),
};

module.exports = { createWebsite, listWebsites, websiteParams, updateWebsite, verifyWebsite };
