'use strict';

const logger = require('../../common/logger');
const { JOB_NAMES } = require('../../common/constants');
const refreshTokenRepository = require('../../modules/auth/repository/refreshToken.repository');
const authTokenRepository = require('../../modules/auth/repository/authToken.repository');
const invitationRepository = require('../../modules/workspaces/repository/invitation.repository');
const visitorRepository = require('../../modules/visitors/repository/visitor.repository');
const attachmentRepository = require('../../modules/attachments/repository/attachment.repository');
const attachmentService = require('../../modules/attachments/service/attachment.service');

const STALE_VISITOR_MS = 10 * 60 * 1000;
const ORPHAN_ATTACHMENT_MS = 24 * 60 * 60 * 1000;

/** Housekeeping. Each job name maps to one bounded, idempotent sweep. */
async function processCleanupJob(job) {
  switch (job.name) {
    case JOB_NAMES.CLEANUP_EXPIRED_SESSIONS: {
      const [refresh, auth] = await Promise.all([
        refreshTokenRepository.deleteExpired(),
        authTokenRepository.deleteExpired(),
      ]);
      const result = { refreshTokens: refresh.deletedCount, authTokens: auth.deletedCount };
      logger.info(result, 'Expired sessions removed');
      return result;
    }

    case JOB_NAMES.CLEANUP_STALE_VISITORS: {
      const cutoff = new Date(Date.now() - STALE_VISITOR_MS);
      const visitors = await visitorRepository.markStaleOffline(cutoff);

      // Uploads that never made it into a message are deleted after a day.
      const orphans = await attachmentRepository.findOrphans(new Date(Date.now() - ORPHAN_ATTACHMENT_MS));
      let removed = 0;
      for (const orphan of orphans) {
        // eslint-disable-next-line no-await-in-loop
        await attachmentService.deleteAttachment(orphan.workspace, orphan._id).catch(() => null);
        removed += 1;
      }

      const result = { visitorsMarkedOffline: visitors.modifiedCount, orphanAttachments: removed };
      logger.info(result, 'Stale visitors swept');
      return result;
    }

    case JOB_NAMES.CLEANUP_EXPIRED_INVITATIONS: {
      const res = await invitationRepository.expireStale();
      logger.info({ expired: res.modifiedCount }, 'Invitations expired');
      return { expired: res.modifiedCount };
    }

    default:
      logger.warn({ name: job.name }, 'Unknown cleanup job');
      return { skipped: true };
  }
}

module.exports = { processCleanupJob };
