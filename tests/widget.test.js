'use strict';

const { api, auth, visitorAuth, setupWorkspace, initVisitor, ORIGIN } = require('./helpers/api');

describe('public widget API', () => {
  it('serves a whitelisted config with no private workspace data', async () => {
    const { widget, workspace, website } = await setupWorkspace();
    const res = await api().get(`/api/v1/public/widgets/${widget.publicKey}`).set('Origin', ORIGIN).expect(200);
    const raw = JSON.stringify(res.body);
    expect(res.body.data.publicKey).toBe(widget.publicKey);
    expect(res.body.data.availability).toEqual({ isOnline: false, agentsOnline: 0 });
    expect(raw).not.toContain(workspace.id);
    expect(raw).not.toContain(website.id);
    expect(raw).not.toContain(widget.id);
    expect(raw).not.toMatch(/email/);
  });

  it('rejects unknown keys and disallowed origins', async () => {
    const { widget } = await setupWorkspace();
    await api().get('/api/v1/public/widgets/wk_doesnotexist000000000000').set('Origin', ORIGIN).expect(404);
    await api().get('/api/v1/public/widgets/not-a-key').expect(422);
    const bad = await api().get(`/api/v1/public/widgets/${widget.publicKey}`).set('Origin', 'https://evil.com').expect(403);
    expect(bad.body.error.code).toBe('ORIGIN_NOT_ALLOWED');
    // Wildcard allowedDomains work.
    await api().get(`/api/v1/public/widgets/${widget.publicKey}`).set('Origin', 'https://shop.example.com').expect(200);
  });

  it('init returns a visitor token, is idempotent on anonymousId, and identify updates the profile', async () => {
    const { widget, workspace, owner } = await setupWorkspace();
    const first = await initVisitor(widget.publicKey, { page: 'https://app.example.com/pricing?utm=secret' });
    expect(first.visitorToken).toBeTruthy();
    expect(first.visitor.anonymousId).toMatch(/^v_/);
    expect(first.activeConversation).toBeNull();

    const second = await initVisitor(widget.publicKey, { anonymousId: first.visitor.anonymousId });
    expect(second.visitor.id).toBe(first.visitor.id);

    await api().patch('/api/v1/public/visitors/me').set(visitorAuth(second.visitorToken)).send({ name: 'Jane', email: 'jane@customer.com' }).expect(200);

    const dash = await api().get(`/api/v1/workspaces/${workspace.id}/visitors/${first.visitor.id}`).set(auth(owner.token)).expect(200);
    expect(dash.body.data.name).toBe('Jane');
    expect(dash.body.data.currentPage).toBe('https://app.example.com/pricing'); // query string dropped
    expect(dash.body.data.sessionCount).toBe(2);
  });

  it('starting a conversation reuses the open one and notifies eligible agents', async () => {
    const { widget, workspace, owner, agent } = await setupWorkspace();
    const v = await initVisitor(widget.publicKey);
    const a = await api().post('/api/v1/public/conversations').set(visitorAuth(v.visitorToken)).send({ content: 'first' }).expect(201);
    expect(a.body.data.created).toBe(true);
    const b = await api().post('/api/v1/public/conversations').set(visitorAuth(v.visitorToken)).send({ content: 'second' }).expect(201);
    expect(b.body.data.created).toBe(false);
    expect(b.body.data.conversation.id).toBe(a.body.data.conversation.id);

    for (const member of [owner, agent]) {
      // eslint-disable-next-line no-await-in-loop
      const n = await api().get('/api/v1/notifications').set(auth(member.token)).expect(200);
      expect(n.body.data.map((x) => x.type)).toContain('NEW_CONVERSATION');
    }
  });

  it('a rotated widget key or an inactive widget invalidates visitor sessions', async () => {
    const { widget, workspace, owner } = await setupWorkspace();
    const v = await initVisitor(widget.publicKey);
    await api().get('/api/v1/public/conversations').set(visitorAuth(v.visitorToken)).expect(200);

    await api().patch(`/api/v1/workspaces/${workspace.id}/widgets/${widget.id}`).set(auth(owner.token)).send({ isActive: false }).expect(200);
    await api().get('/api/v1/public/conversations').set(visitorAuth(v.visitorToken)).expect(404);
    await api().get(`/api/v1/public/widgets/${widget.publicKey}`).set('Origin', ORIGIN).expect(404);
  });

  it('requests missing a visitor session are rejected', async () => {
    await api().get('/api/v1/public/conversations').expect(401);
    await api().get('/api/v1/public/conversations').set({ Authorization: 'Bearer nope', Origin: ORIGIN }).expect(401);
  });
});
