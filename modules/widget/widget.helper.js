// Rnvironment Variables
const env = require("../../config/env");

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
