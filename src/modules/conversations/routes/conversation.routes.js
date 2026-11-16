'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const {
  requireWorkspaceMember,
  requireWorkspacePermission,
} = require('../../../common/middleware/workspaceAccess');
const { PERMISSIONS } = require('../../../common/constants');
const schema = require('../schema/conversation.schema');
const controller = require('../controller/conversation.controller');

const router = express.Router();

/* --------------------------------- reading -------------------------------- */

router.get(
  '/:workspaceId/conversations',
  validate(schema.listConversations),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_VIEW),
  controller.list,
);

// The unassigned queue - every eligible OWNER/AGENT sees the same list.
router.get(
  '/:workspaceId/conversations/unassigned',
  validate(schema.listConversations),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_VIEW),
  controller.listUnassigned,
);

router.get(
  '/:workspaceId/conversations/counts',
  validate({ params: schema.listConversations.params }),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_VIEW),
  controller.counts,
);

router.get(
  '/:workspaceId/conversations/:conversationId',
  validate(schema.conversationParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_VIEW),
  controller.get,
);

router.patch(
  '/:workspaceId/conversations/:conversationId',
  validate(schema.updateConversation),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_VIEW),
  controller.update,
);

/* ------------------------------- assignment ------------------------------- */

// Atomic claim. Returns 409 ALREADY_ASSIGNED when another agent won the race.
router.post(
  '/:workspaceId/conversations/:conversationId/claim',
  validate(schema.conversationParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_CLAIM),
  controller.claim,
);

router.post(
  '/:workspaceId/conversations/:conversationId/assign',
  validate(schema.assignConversation),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_ASSIGN_OTHERS),
  controller.assign,
);

router.post(
  '/:workspaceId/conversations/:conversationId/unassign',
  validate(schema.conversationParams),
  requireWorkspaceMember,
  controller.unassign,
);

/* ------------------------------- lifecycle -------------------------------- */

router.post(
  '/:workspaceId/conversations/:conversationId/close',
  validate(schema.closeConversation),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_CLOSE),
  controller.close,
);

router.post(
  '/:workspaceId/conversations/:conversationId/reopen',
  validate(schema.conversationParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_CLOSE),
  controller.reopen,
);

router.post(
  '/:workspaceId/conversations/:conversationId/read',
  validate(schema.conversationParams),
  requireWorkspaceMember,
  controller.markRead,
);

/* ---------------------------------- tags ---------------------------------- */

router.put(
  '/:workspaceId/conversations/:conversationId/tags',
  validate(schema.setTags),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_TAG),
  controller.setTags,
);

router.post(
  '/:workspaceId/conversations/:conversationId/tags/:tagId',
  validate(schema.conversationTagParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_TAG),
  controller.addTag,
);

router.delete(
  '/:workspaceId/conversations/:conversationId/tags/:tagId',
  validate(schema.conversationTagParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_TAG),
  controller.removeTag,
);

/* -------------------------------- messages -------------------------------- */

router.get(
  '/:workspaceId/conversations/:conversationId/messages',
  validate(schema.listMessages),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_VIEW),
  controller.listMessages,
);

// Sending the first reply implicitly claims an unassigned conversation.
router.post(
  '/:workspaceId/conversations/:conversationId/messages',
  validate(schema.sendMessage),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_REPLY),
  controller.sendMessage,
);

router.patch(
  '/:workspaceId/conversations/:conversationId/messages/:messageId',
  validate(schema.editMessage),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.CONVERSATION_REPLY),
  controller.editMessage,
);

module.exports = router;
