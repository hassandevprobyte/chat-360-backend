'use strict';

const emailService = require('../../services/email/email.service');
const logger = require('../../common/logger');

/** Delivers one templated email. Retries are handled by BullMQ (5 attempts, backoff). */
async function processEmailJob(job) {
  const { to, subject, template, context } = job.data;
  const info = await emailService.deliver({ to, subject, template, context });
  logger.info({ jobId: job.id, template, to }, 'Email job delivered');
  return { messageId: info && info.messageId };
}

module.exports = { processEmailJob };
