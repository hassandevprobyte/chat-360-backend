'use strict';

const PLATFORM_ROLES = Object.freeze({ USER: 'USER', SUPER_ADMIN: 'SUPER_ADMIN' });

const WORKSPACE_ROLES = Object.freeze({ OWNER: 'OWNER', AGENT: 'AGENT' });

/**
 * Permissions exist as a light extensibility hook (WorkspaceMember.permissions).
 * v1 behaviour is driven by role; a member may be granted extra permissions, and
 * OWNER implicitly holds all of them.
 */
const PERMISSIONS = Object.freeze({
  WORKSPACE_MANAGE: 'workspace:manage',
  MEMBER_MANAGE: 'member:manage',
  WEBSITE_MANAGE: 'website:manage',
  WIDGET_MANAGE: 'widget:manage',
  TAG_MANAGE: 'tag:manage',
  AUDIT_LOG_VIEW: 'auditLog:view',
  CONVERSATION_VIEW: 'conversation:view',
  CONVERSATION_CLAIM: 'conversation:claim',
  CONVERSATION_REPLY: 'conversation:reply',
  CONVERSATION_CLOSE: 'conversation:close',
  CONVERSATION_TAG: 'conversation:tag',
  CONVERSATION_ASSIGN_OTHERS: 'conversation:assign_others',
  SHORTCUT_MANAGE_OWN: 'shortcut:manage_own',
});

const AGENT_DEFAULT_PERMISSIONS = Object.freeze([
  PERMISSIONS.CONVERSATION_VIEW,
  PERMISSIONS.CONVERSATION_CLAIM,
  PERMISSIONS.CONVERSATION_REPLY,
  PERMISSIONS.CONVERSATION_CLOSE,
  PERMISSIONS.CONVERSATION_TAG,
  PERMISSIONS.SHORTCUT_MANAGE_OWN,
]);

const CONVERSATION_STATUS = Object.freeze({ OPEN: 'OPEN', PENDING: 'PENDING', CLOSED: 'CLOSED' });

const CONVERSATION_PRIORITY = Object.freeze({
  LOW: 'LOW', NORMAL: 'NORMAL', HIGH: 'HIGH', URGENT: 'URGENT',
});

const SENDER_TYPES = Object.freeze({ VISITOR: 'VISITOR', USER: 'USER', SYSTEM: 'SYSTEM' });

const MESSAGE_TYPES = Object.freeze({
  TEXT: 'TEXT', IMAGE: 'IMAGE', FILE: 'FILE', SYSTEM: 'SYSTEM', INTERNAL_NOTE: 'INTERNAL_NOTE',
});

/** Message types a visitor is ever allowed to see. INTERNAL_NOTE is deliberately absent. */
const VISITOR_VISIBLE_MESSAGE_TYPES = Object.freeze([
  MESSAGE_TYPES.TEXT, MESSAGE_TYPES.IMAGE, MESSAGE_TYPES.FILE, MESSAGE_TYPES.SYSTEM,
]);

const NOTIFICATION_TYPES = Object.freeze({
  NEW_CONVERSATION: 'NEW_CONVERSATION',
  NEW_MESSAGE: 'NEW_MESSAGE',
  CONVERSATION_ASSIGNED: 'CONVERSATION_ASSIGNED',
  MENTION: 'MENTION',
  WORKSPACE_INVITATION: 'WORKSPACE_INVITATION',
  AGENT_INVITATION: 'AGENT_INVITATION',
});

const PRESENCE_STATUS = Object.freeze({ ONLINE: 'ONLINE', AWAY: 'AWAY', OFFLINE: 'OFFLINE' });

const WEBSITE_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', PENDING: 'PENDING' });

const VERIFICATION_STATUS = Object.freeze({
  UNVERIFIED: 'UNVERIFIED', PENDING: 'PENDING', VERIFIED: 'VERIFIED', FAILED: 'FAILED',
});

/** Ways a workspace can prove ownership of a website's domain. */
const VERIFICATION_METHODS = Object.freeze({
  DNS_TXT: 'DNS_TXT',
  META_TAG: 'META_TAG',
  FILE_UPLOAD: 'FILE_UPLOAD',
});

const INVITATION_STATUS = Object.freeze({
  PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REVOKED: 'REVOKED', EXPIRED: 'EXPIRED',
});

const WIDGET_POSITIONS = Object.freeze({ BOTTOM_RIGHT: 'BOTTOM_RIGHT', BOTTOM_LEFT: 'BOTTOM_LEFT' });

const ATTACHMENT_RESOURCES = Object.freeze({ MESSAGE: 'MESSAGE', CONVERSATION: 'CONVERSATION', WIDGET: 'WIDGET' });

const QUEUE_NAMES = Object.freeze({
  EMAIL: 'email',
  NOTIFICATIONS: 'notifications',
  CLEANUP: 'cleanup',
});

const JOB_NAMES = Object.freeze({
  SEND_EMAIL: 'send-email',
  DISPATCH_NOTIFICATION: 'dispatch-notification',
  CLEANUP_EXPIRED_SESSIONS: 'cleanup-expired-sessions',
  CLEANUP_STALE_VISITORS: 'cleanup-stale-visitors',
  CLEANUP_EXPIRED_INVITATIONS: 'cleanup-expired-invitations',
});

const AUDIT_ACTIONS = Object.freeze({
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_SUSPENDED: 'workspace.suspended',
  WORKSPACE_REACTIVATED: 'workspace.reactivated',
  MEMBER_INVITED: 'member.invited',
  MEMBER_JOINED: 'member.joined',
  MEMBER_REMOVED: 'member.removed',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_UPDATED: 'member.updated',
  WEBSITE_CREATED: 'website.created',
  WEBSITE_UPDATED: 'website.updated',
  WEBSITE_DELETED: 'website.deleted',
  WEBSITE_VERIFICATION_TOKEN_ROTATED: 'website.verification_token_rotated',
  WEBSITE_VERIFIED: 'website.verified',
  WEBSITE_VERIFICATION_FAILED: 'website.verification_failed',
  WIDGET_CREATED: 'widget.created',
  WIDGET_UPDATED: 'widget.updated',
  WIDGET_DELETED: 'widget.deleted',
  WIDGET_KEY_ROTATED: 'widget.key_rotated',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_UNASSIGNED: 'conversation.unassigned',
  CONVERSATION_CLOSED: 'conversation.closed',
  CONVERSATION_REOPENED: 'conversation.reopened',
  CONVERSATION_TAGS_CHANGED: 'conversation.tags_changed',
  TAG_CREATED: 'tag.created',
  TAG_UPDATED: 'tag.updated',
  TAG_DELETED: 'tag.deleted',
  SETTINGS_UPDATED: 'settings.updated',
  SUPER_ADMIN_INSPECTED_CONVERSATION: 'super_admin.conversation_inspected',
  SUPER_ADMIN_VIEWED_WORKSPACE: 'super_admin.workspace_viewed',
});

const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FORBIDDEN: 'FORBIDDEN',
  NOT_WORKSPACE_MEMBER: 'NOT_WORKSPACE_MEMBER',
  INSUFFICIENT_ROLE: 'INSUFFICIENT_ROLE',
  INSUFFICIENT_PERMISSION: 'INSUFFICIENT_PERMISSION',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  ALREADY_ASSIGNED: 'ALREADY_ASSIGNED',
  WORKSPACE_SUSPENDED: 'WORKSPACE_SUSPENDED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  ORIGIN_NOT_ALLOWED: 'ORIGIN_NOT_ALLOWED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
});

const ALLOWED_ATTACHMENT_MIME_TYPES = Object.freeze({
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/zip': ['.zip'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
});

module.exports = {
  PLATFORM_ROLES,
  WORKSPACE_ROLES,
  PERMISSIONS,
  AGENT_DEFAULT_PERMISSIONS,
  CONVERSATION_STATUS,
  CONVERSATION_PRIORITY,
  SENDER_TYPES,
  MESSAGE_TYPES,
  VISITOR_VISIBLE_MESSAGE_TYPES,
  NOTIFICATION_TYPES,
  PRESENCE_STATUS,
  WEBSITE_STATUS,
  VERIFICATION_STATUS,
  VERIFICATION_METHODS,
  INVITATION_STATUS,
  WIDGET_POSITIONS,
  ATTACHMENT_RESOURCES,
  QUEUE_NAMES,
  JOB_NAMES,
  AUDIT_ACTIONS,
  ERROR_CODES,
  ALLOWED_ATTACHMENT_MIME_TYPES,
};
