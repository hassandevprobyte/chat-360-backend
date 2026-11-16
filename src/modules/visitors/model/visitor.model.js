'use strict';

const mongoose = require('mongoose');

/**
 * A Visitor is NOT a User. It is an anonymous (optionally identified) end user
 * of the customer's website, scoped to a workspace + website.
 *
 * Privacy: no raw IP is stored. Country comes from a trusted edge header only,
 * and only when the website enables it.
 */
const visitorSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    website: { type: mongoose.Schema.Types.ObjectId, ref: 'Website', required: true },
    widget: { type: mongoose.Schema.Types.ObjectId, ref: 'Widget', default: null },
    // Stable id generated server-side and kept by the widget in localStorage.
    anonymousId: { type: String, required: true },
    name: { type: String, default: null, trim: true, maxlength: 120 },
    email: { type: String, default: null, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, default: null, trim: true, maxlength: 40 },
    isIdentified: { type: Boolean, default: false },
    currentPage: { type: String, default: null, maxlength: 512 },
    referrer: { type: String, default: null, maxlength: 512 },
    browser: { type: String, default: null, maxlength: 40 },
    operatingSystem: { type: String, default: null, maxlength: 40 },
    device: { type: String, default: null, maxlength: 20 },
    country: { type: String, default: null, maxlength: 2 },
    language: { type: String, default: null, maxlength: 16 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    sessionCount: { type: Number, default: 1 },
    // Free-form, customer-supplied attributes. Size-capped at the service layer.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

visitorSchema.index({ workspace: 1, anonymousId: 1 }, { unique: true });
visitorSchema.index({ workspace: 1, website: 1, lastSeenAt: -1 });
visitorSchema.index({ workspace: 1, lastSeenAt: -1 });
visitorSchema.index({ workspace: 1, isOnline: 1 });
visitorSchema.index({ workspace: 1, email: 1 });

module.exports = mongoose.model('Visitor', visitorSchema);
