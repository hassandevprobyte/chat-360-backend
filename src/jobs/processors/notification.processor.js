'use strict';

const env = require('../../config/env');
const logger = require('../../common/logger');
const emailService = require('../../services/email/email.service');

/**
 * Secondary channels for an in-app notification.
 *
 * The in-app record and its Socket.IO push were already done synchronously by
 * notification.service; this processor only handles the slow channel (email).
 * `email.kind` selects the template. Unknown kinds are logged and dropped.
 */
async function processNotificationJob(job) {
  const { email } = job.data;
  if (!email) return { skipped: true };

  const recipients = [].concat(email.to).filter(Boolean);
  if (!recipients.length) return { skipped: true, reason: 'no-recipients' };

  const dashboard = env.app.dashboardUrl.replace(/\/$/, '');

  switch (email.kind) {
    case 'new-conversation':
      await Promise.all(
        recipients.map((to) =>
          emailService.sendNewConversationEmail({
            to,
            workspace: email.workspace,
            website: email.website,
            visitor: email.visitor || {},
            conversationId: email.conversationId,
            preview: email.preview,
          }),
        ),
      );
      break;

    case 'new-message':
      await Promise.all(
        recipients.map((to) =>
          emailService.sendConversationNotification({
            to,
            workspace: email.workspace,
            visitor: email.visitor || {},
            conversationId: email.conversationId,
            preview: email.preview,
          }),
        ),
      );
      break;

    case 'generic':
      await Promise.all(
        recipients.map((to) =>
          emailService.sendGenericNotification({
            to,
            title: email.title,
            message: email.message,
            actionUrl: email.actionPath ? `${dashboard}${email.actionPath}` : dashboard,
            actionLabel: email.actionLabel,
          }),
        ),
      );
      break;

    default:
      logger.warn({ kind: email.kind, jobId: job.id }, 'Unknown notification email kind');
      return { skipped: true, reason: 'unknown-kind' };
  }

  return { sent: recipients.length };
}

module.exports = { processNotificationJob };
