'use strict';

/**
 * Seed script.
 *
 *   npm run seed
 *
 * Creates the platform Super Admin and, when SEED_DEMO=true, a demo workspace
 * with an owner, an agent, a website, a widget, a few tags and shortcuts.
 * Credentials come ONLY from environment variables - nothing is hard-coded -
 * and the script is idempotent: re-running it updates rather than duplicates.
 */

const env = require('../config/env');
const logger = require('../common/logger');
const { connectDatabase, disconnectDatabase } = require('../config/database');
const { closeRedis } = require('../config/redis');
const { PLATFORM_ROLES, WORKSPACE_ROLES } = require('../common/constants');
const { hashPassword, generatePublicKey } = require('../common/utils/crypto');
const userRepository = require('../modules/users/repository/user.repository');
const User = require('../modules/users/model/user.model');
const workspaceRepository = require('../modules/workspaces/repository/workspace.repository');
const workspaceService = require('../modules/workspaces/service/workspace.service');
const memberRepository = require('../modules/workspaces/repository/workspaceMember.repository');
const websiteRepository = require('../modules/websites/repository/website.repository');
const widgetRepository = require('../modules/widgets/repository/widget.repository');
const tagRepository = require('../modules/tags/repository/tag.repository');
const shortcutRepository = require('../modules/messageShortcuts/repository/messageShortcut.repository');

const required = (value, name) => {
  if (!value) throw new Error(`${name} is required for seeding`);
  return value;
};

async function upsertUser({ name, email, password, platformRole }) {
  const existing = await userRepository.findByEmail(email);
  const passwordHash = await hashPassword(password);
  if (existing) {
    await User.updateOne({ _id: existing._id }, { $set: { name, password: passwordHash, platformRole, isActive: true } });
    logger.info({ email, platformRole }, 'User updated');
    return userRepository.findById(existing._id);
  }
  const user = await User.create({
    name,
    email,
    password: passwordHash,
    platformRole,
    isActive: true,
    emailVerifiedAt: new Date(),
  });
  logger.info({ email, platformRole }, 'User created');
  return userRepository.findById(user._id);
}

async function seedSuperAdmin() {
  return upsertUser({
    name: env.seed.superAdminName,
    email: required(env.seed.superAdminEmail, 'SEED_SUPER_ADMIN_EMAIL'),
    password: required(env.seed.superAdminPassword, 'SEED_SUPER_ADMIN_PASSWORD'),
    platformRole: PLATFORM_ROLES.SUPER_ADMIN,
  });
}

async function seedDemo() {
  const owner = await upsertUser({
    name: 'Demo Owner',
    email: required(env.seed.ownerEmail, 'SEED_OWNER_EMAIL'),
    password: required(env.seed.ownerPassword, 'SEED_OWNER_PASSWORD'),
    platformRole: PLATFORM_ROLES.USER,
  });
  const agent = await upsertUser({
    name: 'Demo Agent',
    email: required(env.seed.agentEmail, 'SEED_AGENT_EMAIL'),
    password: required(env.seed.agentPassword, 'SEED_AGENT_PASSWORD'),
    platformRole: PLATFORM_ROLES.USER,
  });

  let workspace = await workspaceRepository.findBySlug('demo-workspace');
  if (!workspace) {
    const created = await workspaceService.createWorkspace(owner, { name: 'Demo Workspace' });
    workspace = await workspaceRepository.findById(created.id);
    await workspaceRepository.updateById(workspace._id, { $set: { slug: 'demo-workspace' } });
    logger.info('Demo workspace created');
  }

  await memberRepository.upsertMembership(workspace._id, agent._id, {
    role: WORKSPACE_ROLES.AGENT,
    isActive: true,
  });

  let website = await websiteRepository.findByDomain(workspace._id, 'localhost');
  if (!website) {
    website = (
      await websiteRepository.create({
        workspace: workspace._id,
        name: 'Local Dev Site',
        domain: 'localhost',
        allowedDomains: ['127.0.0.1'],
        settings: { enforceOriginCheck: false },
      })
    ).toObject();
    logger.info('Demo website created');
  }

  const widgets = await widgetRepository.paginate({ filter: { workspace: workspace._id, website: website._id, deletedAt: null }, limit: 1 });
  let widget = widgets.items[0];
  if (!widget) {
    widget = (
      await widgetRepository.create({
        workspace: workspace._id,
        website: website._id,
        name: 'Default widget',
        publicKey: generatePublicKey(),
        settings: { welcomeMessage: 'Hi there! How can we help?', fileUploadEnabled: true },
      })
    ).toObject();
    logger.info('Demo widget created');
  }

  for (const tag of [
    { name: 'Billing', color: '#f59e0b' },
    { name: 'Bug', color: '#ef4444' },
    { name: 'Sales', color: '#10b981' },
  ]) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await tagRepository.findByNameKey(workspace._id, tag.name.toLowerCase()))) {
      // eslint-disable-next-line no-await-in-loop
      await tagRepository.create({ ...tag, nameKey: tag.name.toLowerCase(), workspace: workspace._id, createdBy: owner._id });
    }
  }

  const shortcuts = [
    { shortcut: 'hello', content: 'Hi! Thanks for reaching out. How can I help you today?' },
    { shortcut: 'brb', content: 'One moment please, I am checking that for you.' },
    { shortcut: 'bye', content: 'Thanks for chatting with us. Have a great day!' },
  ];
  for (const user of [owner, agent]) {
    for (const s of shortcuts) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await shortcutRepository.findByShortcut(workspace._id, user._id, s.shortcut))) {
        // eslint-disable-next-line no-await-in-loop
        await shortcutRepository.create({ ...s, workspace: workspace._id, user: user._id });
      }
    }
  }

  return {
    workspaceId: String(workspace._id),
    websiteId: String(website._id),
    widgetId: String(widget._id),
    widgetPublicKey: widget.publicKey,
    owner: owner.email,
    agent: agent.email,
  };
}

async function run() {
  await connectDatabase();
  const admin = await seedSuperAdmin();
  const summary = { superAdmin: admin.email };
  if (env.seed.demo) Object.assign(summary, await seedDemo());
  logger.info(summary, 'Seed complete');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  run()
    .then(async () => {
      await closeRedis().catch(() => {});
      await disconnectDatabase();
      process.exit(0);
    })
    .catch(async (err) => {
      logger.fatal({ err }, 'Seed failed');
      await disconnectDatabase().catch(() => {});
      process.exit(1);
    });
}

module.exports = { run, seedSuperAdmin, seedDemo };
