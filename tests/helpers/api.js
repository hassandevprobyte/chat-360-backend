'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const memberRepository = require('../../src/modules/workspaces/repository/workspaceMember.repository');
const userRepository = require('../../src/modules/users/repository/user.repository');
const { WORKSPACE_ROLES, PLATFORM_ROLES } = require('../../src/common/constants');

const app = createApp();
const api = () => request(app);

let counter = 0;
const uniqueEmail = (prefix = 'user') => `${prefix}-${Date.now()}-${(counter += 1)}@example.com`;

const PASSWORD = 'CorrectHorseBattery1';

/** Registers a user through the real endpoint; returns { user, token }. */
async function registerUser(overrides = {}) {
  const body = { name: overrides.name || 'Test User', email: overrides.email || uniqueEmail(), password: PASSWORD };
  const res = await api().post('/api/v1/auth/register').send(body).expect(201);
  return { user: res.body.data.user, token: res.body.data.accessToken, email: body.email, password: PASSWORD };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function createWorkspace(token, name = 'Acme') {
  const res = await api().post('/api/v1/workspaces').set(auth(token)).send({ name }).expect(201);
  return res.body.data;
}

/** Adds an existing user to a workspace as AGENT directly (invitation flow is tested separately). */
async function addAgent(workspaceId, userId, role = WORKSPACE_ROLES.AGENT) {
  return memberRepository.upsertMembership(workspaceId, userId, { role, isActive: true });
}

async function makeSuperAdmin(userId) {
  await userRepository.updateById(userId, { $set: { platformRole: PLATFORM_ROLES.SUPER_ADMIN } });
  await userRepository.incrementTokenVersion(userId);
}

async function createWebsite(token, workspaceId, overrides = {}) {
  const res = await api()
    .post(`/api/v1/workspaces/${workspaceId}/websites`)
    .set(auth(token))
    .send({ name: 'Site', domain: 'example.com', allowedDomains: ['*.example.com'], ...overrides })
    .expect(201);
  return res.body.data;
}

async function createWidget(token, workspaceId, websiteId, overrides = {}) {
  const res = await api()
    .post(`/api/v1/workspaces/${workspaceId}/widgets`)
    .set(auth(token))
    .send({ name: 'Widget', websiteId, settings: { fileUploadEnabled: true }, ...overrides })
    .expect(201);
  return res.body.data;
}

/** Full tenant: owner + agent + website + widget. */
async function setupWorkspace() {
  const owner = await registerUser({ name: 'Owner' });
  const agent = await registerUser({ name: 'Agent' });
  const workspace = await createWorkspace(owner.token);
  await addAgent(workspace.id, agent.user.id);
  const website = await createWebsite(owner.token, workspace.id);
  const widget = await createWidget(owner.token, workspace.id, website.id);
  return { owner, agent, workspace, website, widget };
}

const ORIGIN = 'https://app.example.com';

async function initVisitor(publicKey, body = {}) {
  const res = await api()
    .post(`/api/v1/public/widgets/${publicKey}/visitors/init`)
    .set('Origin', ORIGIN)
    .send(body)
    .expect(200);
  return res.body.data;
}

const visitorAuth = (visitorToken) => ({ Authorization: `Bearer ${visitorToken}`, Origin: ORIGIN });

async function startConversation(visitorToken, content = 'Hello, I need help') {
  const res = await api().post('/api/v1/public/conversations').set(visitorAuth(visitorToken)).send({ content }).expect(201);
  return res.body.data;
}

/** Owner + agent + a fresh unassigned conversation from a visitor. */
async function setupWithConversation() {
  const ctx = await setupWorkspace();
  const visitor = await initVisitor(ctx.widget.publicKey);
  const started = await startConversation(visitor.visitorToken);
  return { ...ctx, visitor, conversation: started.conversation };
}

module.exports = {
  app,
  api,
  auth,
  visitorAuth,
  PASSWORD,
  ORIGIN,
  uniqueEmail,
  registerUser,
  createWorkspace,
  addAgent,
  makeSuperAdmin,
  createWebsite,
  createWidget,
  setupWorkspace,
  initVisitor,
  startConversation,
  setupWithConversation,
};
