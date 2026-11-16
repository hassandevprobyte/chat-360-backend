'use strict';

const nodemailer = require('nodemailer');
const env = require('../../config/env');
const logger = require('../../common/logger');

let transporter = null;

/**
 * Thin provider abstraction. `log` writes the rendered email to the logger,
 * which keeps local development and CI from needing an SMTP server.
 */
function getTransport() {
  if (transporter) return transporter;

  if (env.mail.driver === 'log' || env.isTest) {
    transporter = {
      sendMail: async (message) => {
        logger.info({ to: message.to, subject: message.subject }, 'Email (log driver) not sent');
        return { messageId: `log-${Date.now()}`, accepted: [message.to] };
      },
      verify: async () => true,
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.mail.smtp.host,
    port: env.mail.smtp.port,
    secure: env.mail.smtp.secure,
    auth: env.mail.smtp.user ? { user: env.mail.smtp.user, pass: env.mail.smtp.password } : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return transporter;
}

async function verifyTransport() {
  try {
    await getTransport().verify();
    logger.info('SMTP transport verified');
    return true;
  } catch (err) {
    logger.error({ err }, 'SMTP transport verification failed');
    return false;
  }
}

module.exports = { getTransport, verifyTransport };
