const Boom = require("@hapi/boom");

// Validations
const widgetValidation = require("./widget.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");

// Rnvironment Variables
const env = require("../../config/env");

// Common
const { MESSAGE, STATUSES } = require("../../common/constants");

// Utils
const sanitize = require("../../common/utils/sanitize");
const encryption = require("../../common/utils/encryption");

exports.serializePublicWidgetConfig = (widget, { website, isOnline = false, agents = 0 } = {}) => {
  const settings = widget.settings || {};
  const branding = settings.branding || {};
  const preChat = settings.preChatForm || {};
  const hours = settings.businessHours || {};

  return {
    publicKey: widget.publicKey,
    name: widget.name,
    appearance: {
      primaryColor: settings.primaryColor,
      launcherColor: settings.launcherColor,
      textColor: settings.textColor,
      position: settings.position,
      offsetX: settings.offsetX,
      offsetY: settings.offsetY,
      logo: settings.logo || null,
      avatar: settings.avatar || null,
      launcherText: settings.launcherText || null,
    },
    content: {
      headerTitle: settings.headerTitle,
      headerSubtitle: settings.headerSubtitle,
      welcomeMessage: settings.welcomeMessage,
      offlineMessage: settings.offlineMessage,
    },
    behaviour: {
      soundNotification: Boolean(settings.soundNotification),
      fileUploadEnabled: Boolean(settings.fileUploadEnabled),
      showAgentAvailability: Boolean(settings.showAgentAvailability),
    },
    preChatForm: {
      enabled: Boolean(preChat.enabled),
      fields: (preChat.fields || []).map((f) => ({ key: f.key, label: f.label, required: Boolean(f.required) })),
    },
    businessHours: {
      enabled: Boolean(hours.enabled),
      timezone: hours.timezone || "UTC",
      days: hours.days || {},
    },
    branding: {
      showBranding: branding.showBranding !== false,
      brandingText: branding.brandingText || null,
      brandingUrl: branding.brandingUrl || null,
    },
    availability: {
      isOnline: Boolean(isOnline),
      agentsOnline: agents,
    },
    website: website ? { name: website.name } : null,
  };
};

exports.buildEmbedSnippet = (publicKey, widgetUrl = env.WIDGET_URL) => {
  return `<script src="${widgetUrl}/widget.js" data-widget="${publicKey}" async></script>`;
};

exports.serializeWidget = (widget) => {
  return {
    id: String(widget._id || widget.id),
    workspaceId: String(widget.workspace),
    websiteId: String(widget.website),
    name: widget.name,
    publicKey: widget.publicKey,
    isActive: widget.isActive !== false,
    settings: widget.settings || {},
    embedSnippet: exports.buildEmbedSnippet(widget.publicKey),
    createdAt: widget.createdAt,
    updatedAt: widget.updatedAt,
  };
};

exports.resolveByPublicKey = async (publicKey) => {
  const widget = await widgetValidation.throwErrorIfWidgetPublicKeyDoesNotExist(publicKey);

  if (encryption.decrypt(widget.publicKey) !== encryption.decrypt(publicKey)) {
    throw Boom.conflict(MESSAGE.error.auth.forbidden);
  }

  if (!widget.isActive) {
    throw Boom.conflict(MESSAGE.error.widget.inActive);
  }

  const [website, workspace] = await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(String(widget?.workspace?._id)),
    websiteValidation.throwErrorIfWebsiteDoesNotExistInContextOfWorkspace(String(widget?.website?._id), String(widget?.workspace?._id)),
  ]);

  if (website.status !== STATUSES.WEBSITE.ACTIVE) {
    throw Boom.conflict(MESSAGE.error.website.inActive);
  }

  if (workspace.status !== STATUSES.WEBSITE.ACTIVE) {
    throw Boom.conflict(MESSAGE.error.workspace.currentStatus(workspace.status));
  }

  return { widget, website, workspace };
};

exports.resolveByIds = async ({ ws, site, wid }) => {
  const [workspace, website, widget] = await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(ws),
    websiteValidation.throwErrorIfWebsiteDoesNotExistInContextOfWorkspace(site, ws),
    widgetValidation.throwErrorIfWidgetDoesNotExistInContextOfWorkspaceAndWebsite(wid, ws, site),
  ]);

  return { workspace, website, widget };
};

exports.requestOriginHost = (req) => {
  const origin = req.get("origin") || req.get("referer") || "";
  return origin ? sanitize.originToHost(origin) : null;
};

exports.assertOriginAllowed = async (website, req) => {
  const origin = exports.requestOriginHost(req);

  await websiteValidation.throeErrorIfAllowedDomainDoesNotExist(String(website._id), origin);

  return origin;
};
