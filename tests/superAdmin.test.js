'use strict';

const { api, auth, registerUser, makeSuperAdmin, setupWithConversation, PASSWORD } = require('./helpers/api');

async function superAdmin() {
  const u = await registerUser({ name: 'Root' });
  await makeSuperAdmin(u.user.id);
  const login = await api().post('/api/v1/auth/login').send({ email: u.email, password: PASSWORD }).expect(200);
  return { ...u, token: login.body.data.accessToken };
}

describe('super admin', () => {
  it('workspace OWNER is not a super admin', async () => {
    const { owner } = await setupWithConversation();
    await api().get('/api/v1/super-admin/workspaces').set(auth(owner.token)).expect(403);
  });

  it('lists users/workspaces, inspects conversations across tenants, and is audited', async () => {
    const root = await superAdmin();
    const a = await setupWithConversation();

    const users = await api().get('/api/v1/super-admin/users').set(auth(root.token)).expect(200);
    expect(users.body.meta.pagination.total).toBeGreaterThanOrEqual(3);

    const workspaces = await api().get('/api/v1/super-admin/workspaces').set(auth(root.token)).expect(200);
    expect(workspaces.body.data.map((w) => w.id)).toContain(a.workspace.id);

    const inspect = await api()
      .get(`/api/v1/super-admin/workspaces/${a.workspace.id}/conversations/${a.conversation.id}`)
      .set(auth(root.token))
      .expect(200);
    expect(inspect.body.data.messages).toHaveLength(1);

    const logs = await api().get(`/api/v1/workspaces/${a.workspace.id}/audit-logs`).set(auth(a.owner.token)).expect(200);
    expect(logs.body.data.map((l) => l.action)).toContain('super_admin.conversation_inspected');
  });

  it('suspending a workspace locks out its members and its widget; reactivation restores access', async () => {
    const root = await superAdmin();
    const a = await setupWithConversation();

    await api().post(`/api/v1/super-admin/workspaces/${a.workspace.id}/suspend`).set(auth(root.token)).send({ reason: 'abuse' }).expect(200);
    const locked = await api().get(`/api/v1/workspaces/${a.workspace.id}`).set(auth(a.owner.token)).expect(403);
    expect(locked.body.error.code).toBe('WORKSPACE_SUSPENDED');
    await api().get('/api/v1/public/conversations').set({ Authorization: `Bearer ${a.visitor.visitorToken}`, Origin: 'https://app.example.com' }).expect(404);

    await api().post(`/api/v1/super-admin/workspaces/${a.workspace.id}/reactivate`).set(auth(root.token)).send({}).expect(200);
    await api().get(`/api/v1/workspaces/${a.workspace.id}`).set(auth(a.owner.token)).expect(200);
  });

  it('deactivating a user invalidates their sessions', async () => {
    const root = await superAdmin();
    const victim = await registerUser();
    await api().patch(`/api/v1/super-admin/users/${victim.user.id}/status`).set(auth(root.token)).send({ isActive: false }).expect(200);
    const me = await api().get('/api/v1/me').set(auth(victim.token)).expect(403);
    expect(me.body.error.code).toBe('ACCOUNT_INACTIVE');
    await api().post('/api/v1/auth/login').send({ email: victim.email, password: PASSWORD }).expect(403);
  });
});
