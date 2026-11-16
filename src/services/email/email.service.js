'use strict';

const env = require('../../config/env');
const logger = require('../../common/logger');
const { QUEUE_NAMES, JOB_NAMES } = require('../../common/constants');
const { enqueue } = require('../../jobs/queues');
const { render, toPlainText } = require('./templateRenderer');
const { getTransport } = require('./transport');

/**
 * Email is always queued from request handlers - an SMTP hiccup must never turn
 * into a failed signup. `deliver` is the synchronous path used by the worker.
 */
async function queueEmail({ to, subject, template, context = {}, jobOptions }) {
  if (!to) {
    logger.warn({ template }, 'Email skipped: no recipient');
    return null;
  }
  const job = await enqueue(
    QUEUE_NAMES.EMAIL,
    JOB_NAMES.SEND_EMAIL,
    { to, subject, template, context },
    jobOptions,
  );

  // When queues are disabled (tests / degraded mode) fall back to direct send so
  // behaviour stays observable rather than silently dropping mail.
  if (!job) return deliver({ to, subject, template, context }).catch((err) => {
    logger.error({ err, template }, 'Direct email delivery failed');
    return null;
  });

  return job;
}

async function deliver({ to, subject, template, context = {} }) {
  const html = render(template, { ...context, subject });
  const info = await getTransport().sendMail({
    from: env.mail.from,
    to,
    subject,
    html,
    text: toPlainText(html),
  });
  logger.info({ to, template, messageId: info.messageId }, 'Email delivered');
  return info;
}

const link = (pathname, params = {}) => {
  const url = new URL(pathname, env.app.dashboardUrl);
  Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, v));
  return url.toString();
};

/* ------------------------------------------------------------------ *
 * Public API - the only surface controllers/services should touch.
 * ------------------------------------------------------------------ */

const sendVerificationEmail = ({ user, token }) =>
  queueEmail({
    to: user.email,
    subject: `Confirm your ${env.app.name} email address`,
    template: 'verify-email',
    context: {
      name: user.name,
      verifyUrl: link('/verify-email', { token }),
      expiresIn: env.tokens.emailVerificationExpiresIn,
    },
  });

const sendPasswordResetEmail = ({ user, token }) =>
  queueEmail({
    to: user.email,
    subject: `Reset your ${env.app.name} password`,
    template: 'reset-password',
    context: {
      name: user.name,
      resetUrl: link('/reset-password', { token }),
      expiresIn: env.tokens.passwordResetExpiresIn,
    },
  });

const sendWorkspaceInvitation = ({ email, token, workspace, inviter, role }) =>
  queueEmail({
    to: email,
    subject: `${inviter.name} invited you to ${workspace.name}`,
    template: role === 'AGENT' ? 'agent-invitation' : 'workspace-invitation',
    context: {
      workspaceName: workspace.name,
      inviterName: inviter.name,
      role,
      inviteUrl: link('/invitations/accept', { token }),
      expiresIn: env.tokens.invitationExpiresIn,
    },
  });

const sendNewConversationEmail = ({ to, workspace, website, visitor, conversationId, preview }) =>
  queueEmail({
    to,
    subject: `New chat in ${workspace.name}`,
    template: 'new-conversation',
    context: {
      workspaceName: workspace.name,
      websiteName: website ? website.name : 'your website',
      visitorName: visitor.name || 'A visitor',
      visitorEmail: visitor.email || null,
      preview: preview || 'No message preview available.',
      conversationUrl: link(`/workspaces/${workspace._id}/conversations/${conversationId}`),
    },
  });

const sendConversationNotification = ({ to, workspace, visitor, conversationId, preview }) =>
  queueEmail({
    to,
    subject: `New message from ${visitor.name || 'a visitor'}`,
    template: 'new-message',
    context: {
      workspaceName: workspace.name,
      visitorName: visitor.name || 'A visitor',
      preview: preview || '',
      conversationUrl: link(`/workspaces/${workspace._id}/conversations/${conversationId}`),
    },
  });

const sendGenericNotification = ({ to, title, message, actionUrl, actionLabel = 'Open dashboard' }) =>
  queueEmail({
    to,
    subject: title,
    template: 'notification',
    context: { title, message, actionUrl, actionLabel },
  });

module.exports = {
  queueEmail,
  deliver,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWorkspaceInvitation,
  sendNewConversationEmail,
  sendConversationNotification,
  sendGenericNotification,
};
