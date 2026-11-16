'use strict';

const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const env = require('../../config/env');
const { InternalError } = require('../../common/errors');

const TEMPLATE_DIR = path.join(__dirname, '..', '..', 'templates', 'emails');

const cache = new Map();
let partialsRegistered = false;

const read = (name) => fs.readFileSync(path.join(TEMPLATE_DIR, `${name}.hbs`), 'utf8');

function registerPartials() {
  if (partialsRegistered) return;
  fs.readdirSync(TEMPLATE_DIR)
    .filter((file) => file.startsWith('_') && file.endsWith('.hbs'))
    .forEach((file) => {
      const name = file.replace(/^_/, '').replace(/\.hbs$/, '');
      Handlebars.registerPartial(name, read(file.replace(/\.hbs$/, '')));
    });
  partialsRegistered = true;
}

function compile(name) {
  if (cache.has(name)) return cache.get(name);
  registerPartials();
  try {
    const template = Handlebars.compile(read(name), { noEscape: false });
    // Templates are static assets; compile once per process.
    if (env.isProduction) cache.set(name, template);
    return template;
  } catch (err) {
    throw new InternalError(`Email template '${name}' could not be compiled`);
  }
}

/**
 * Renders a template inside the shared layout. Business logic passes plain data
 * and never touches HTML.
 */
function render(templateName, context = {}) {
  const data = { appName: env.app.name, dashboardUrl: env.app.dashboardUrl, ...context };
  const body = compile(templateName)(data);
  return compile('layout')({ ...data, body, subject: data.subject || env.app.name });
}

/** Naive but effective plain-text alternative for deliverability. */
function toPlainText(html) {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|tr|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&middot;/g, '-')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

module.exports = { render, toPlainText, TEMPLATE_DIR };
