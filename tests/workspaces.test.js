'use strict';

const { api, auth, registerUser, createWorkspace, addAgent, setupWorkspace } = require('./helpers/api');

describe('workspaces & roles', () => {
  it('creator becomes OWNER and only sees their own workspaces', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const ws = await createWorkspace(a.token, 'A Corp');
    expect(ws.myRole).toBe('OWNER');

    const listA = await api().get('/api/v1/workspaces').set(auth(a.token)).expect(200);
    expect(listA.body.data.map((w) => w.id)).toContain(ws.id);

    const listB = await api().get('/api/v1/workspaces').set(auth(b.token)).expect(200);
    expect(listB.body.data).toHaveLength(0);
  });

  it('non-members get 403 NOT_WORKSPACE_MEMBER on workspace routes', async () => {
    const { workspace } = await setupWorkspace();
    const outsider = await registerUser();
    const res = await api().get(`/api/v1/workspaces/${workspace.id}`).set(auth(outsider.token)).expect(403);
    expect(res.body.error.code).toBe('NOT_WORKSPACE_MEMBER');
  });

  it('AGENT cannot perform OWNER-only actions', async () => {
    const { workspace, agent } = await setupWorkspace();
    const rename = await api()
      .patch(`/api/v1/workspaces/${workspace.id}`)
      .set(auth(agent.token))
      .send({ name: 'Hijacked' })
      .expect(403);
    expect(rename.body.error.code).toBe('INSUFFICIENT_ROLE');

    await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites`)
      .set(auth(agent.token))
      .send({ name: 'x', domain: 'x.com' })
      .expect(403);

    await api().get(`/api/v1/workspaces/${workspace.id}/audit-logs`).set(auth(agent.token)).expect(403);
  });

  it('only OWNER and AGENT roles exist; an unknown role is rejected', async () => {
    const { workspace, owner } = await setupWorkspace();
    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/members/invite`)
      .set(auth(owner.token))
      .send({ email: 'new@example.com', role: 'ADMIN' })
      .expect(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invitation flow adds an AGENT member (token must match the invited email)', async () => {
    const { workspace, owner } = await setupWorkspace();
    const invitee = await registerUser();
    const stranger = await registerUser();

    const emailService = require('../src/services/email/email.service');
    const spy = jest.spyOn(emailService, 'sendWorkspaceInvitation').mockResolvedValue(null);

    await api()
      .post(`/api/v1/workspaces/${workspace.id}/members/invite`)
      .set(auth(owner.token))
      .send({ email: invitee.email, role: 'AGENT' })
      .expect(201);

    const rawToken = spy.mock.calls[0][0].token;
    spy.mockRestore();
    expect(rawToken).toBeTruthy();

    // Someone else holding the link cannot use it.
    await api().post('/api/v1/invitations/accept').set(auth(stranger.token)).send({ token: rawToken }).expect(403);

    const accepted = await api().post('/api/v1/invitations/accept').set(auth(invitee.token)).send({ token: rawToken }).expect(200);
    expect(accepted.body.data.member.role).toBe('AGENT');

    // Now a member: can read the workspace, still cannot manage it.
    await api().get(`/api/v1/workspaces/${workspace.id}`).set(auth(invitee.token)).expect(200);
    await api().patch(`/api/v1/workspaces/${workspace.id}`).set(auth(invitee.token)).send({ name: 'x' }).expect(403);

    // A used token is dead.
    await api().post('/api/v1/invitations/accept').set(auth(invitee.token)).send({ token: rawToken }).expect(400);
  });

  it('cannot remove the last owner', async () => {
    const { workspace, owner } = await setupWorkspace();
    const members = await api().get(`/api/v1/workspaces/${workspace.id}/members`).set(auth(owner.token)).expect(200);
    const ownerMember = members.body.data.find((m) => m.role === 'OWNER');
    const res = await api()
      .delete(`/api/v1/workspaces/${workspace.id}/members/${ownerMember.id}`)
      .set(auth(owner.token));
    expect([400, 409]).toContain(res.status);
  });

  it('members endpoint lists OWNER and AGENT (no separate agent collection)', async () => {
    const { workspace, owner, agent } = await setupWorkspace();
    const extra = await registerUser();
    await addAgent(workspace.id, extra.user.id);
    const res = await api().get(`/api/v1/workspaces/${workspace.id}/members`).set(auth(owner.token)).expect(200);
    const roles = res.body.data.map((m) => m.role).sort();
    expect(roles).toEqual(['AGENT', 'AGENT', 'OWNER']);
    expect(res.body.data.map((m) => m.user.id)).toEqual(expect.arrayContaining([agent.user.id, extra.user.id]));
  });
});
