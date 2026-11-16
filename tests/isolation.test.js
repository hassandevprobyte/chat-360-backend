'use strict';

const { api, auth, visitorAuth, setupWithConversation, initVisitor, startConversation } = require('./helpers/api');

const ws = (id) => `/api/v1/workspaces/${id}`;

describe('tenant isolation', () => {
  it('workspace A members cannot read, claim, tag or message workspace B conversations', async () => {
    const a = await setupWithConversation();
    const b = await setupWithConversation();

    // Wrong workspace in the URL -> not a member.
    const notMember = await api().get(`${ws(b.workspace.id)}/conversations/${b.conversation.id}`).set(auth(a.owner.token)).expect(403);
    expect(notMember.body.error.code).toBe('NOT_WORKSPACE_MEMBER');

    // Own workspace in the URL, foreign conversation id -> 404 (no cross-tenant lookup exists).
    await api().get(`${ws(a.workspace.id)}/conversations/${b.conversation.id}`).set(auth(a.owner.token)).expect(404);
    await api().post(`${ws(a.workspace.id)}/conversations/${b.conversation.id}/claim`).set(auth(a.agent.token)).expect(404);
    await api().post(`${ws(a.workspace.id)}/conversations/${b.conversation.id}/messages`).set(auth(a.agent.token)).send({ content: 'x' }).expect(404);
    await api().get(`${ws(a.workspace.id)}/conversations/${b.conversation.id}/messages`).set(auth(a.agent.token)).expect(404);

    // B is untouched.
    const detail = await api().get(`${ws(b.workspace.id)}/conversations/${b.conversation.id}`).set(auth(b.owner.token)).expect(200);
    expect(detail.body.data.assignedTo).toBeNull();
    expect(detail.body.data.messageCount).toBe(1);

    // Lists never leak across tenants.
    const listA = await api().get(`${ws(a.workspace.id)}/conversations`).set(auth(a.owner.token)).expect(200);
    expect(listA.body.data.map((c) => c.id)).toEqual([a.conversation.id]);
  });

  it('websites, widgets, visitors and tags are workspace-scoped', async () => {
    const a = await setupWithConversation();
    const b = await setupWithConversation();

    await api().get(`${ws(a.workspace.id)}/websites/${b.website.id}`).set(auth(a.owner.token)).expect(404);
    await api().get(`${ws(a.workspace.id)}/widgets/${b.widget.id}`).set(auth(a.owner.token)).expect(404);
    await api().get(`${ws(a.workspace.id)}/visitors/${b.visitor.visitor.id}`).set(auth(a.owner.token)).expect(404);

    const tag = await api().post(`${ws(b.workspace.id)}/tags`).set(auth(b.owner.token)).send({ name: 'VIP' }).expect(201);
    // Applying a foreign tag to your own conversation is rejected.
    await api()
      .put(`${ws(a.workspace.id)}/conversations/${a.conversation.id}/tags`)
      .set(auth(a.owner.token))
      .send({ tagIds: [tag.body.data.id] })
      .expect(404);

    // Creating a widget for a foreign website is rejected.
    await api().post(`${ws(a.workspace.id)}/widgets`).set(auth(a.owner.token)).send({ name: 'x', websiteId: b.website.id }).expect(404);
  });

  it('a visitor can only see their own conversations, even inside the same workspace', async () => {
    const a = await setupWithConversation();
    const other = await initVisitor(a.widget.publicKey);
    const otherConv = await startConversation(other.visitorToken, 'I am someone else');

    await api().get(`/api/v1/public/conversations/${otherConv.conversation.id}`).set(visitorAuth(a.visitor.visitorToken)).expect(404);
    await api().get(`/api/v1/public/conversations/${otherConv.conversation.id}/messages`).set(visitorAuth(a.visitor.visitorToken)).expect(404);
    await api()
      .post(`/api/v1/public/conversations/${otherConv.conversation.id}/messages`)
      .set(visitorAuth(a.visitor.visitorToken))
      .send({ content: 'hijack' })
      .expect(404);

    const mine = await api().get('/api/v1/public/conversations').set(visitorAuth(a.visitor.visitorToken)).expect(200);
    expect(mine.body.data.map((c) => c.id)).toEqual([a.conversation.id]);
  });

  it('visitor tokens are not dashboard tokens and vice versa', async () => {
    const a = await setupWithConversation();
    await api().get(`${ws(a.workspace.id)}/conversations`).set(auth(a.visitor.visitorToken)).expect(401);
    await api().get('/api/v1/public/conversations').set({ Authorization: `Bearer ${a.owner.token}`, Origin: 'https://app.example.com' }).expect(401);
  });
});
