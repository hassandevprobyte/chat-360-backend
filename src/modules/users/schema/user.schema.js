'use strict';

const Joi = require('joi');
const { name } = require('../../../common/validators/common.validators');

const updateMe = {
  body: Joi.object({
    name,
    avatar: Joi.string().uri().max(512).allow(null, ''),
  }).min(1),
};

module.exports = { updateMe };
