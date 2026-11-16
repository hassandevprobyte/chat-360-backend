'use strict';

const { api, auth, visitorAuth, setupWithConversation } = require('./helpers/api');

const ws = (id) => `/api/v1/workspaces/${id}`;

describe('messages & internal notes', () => {
  it('internal notes are visible to agents and never to the visitor', async () => {
    const { workspace, agent, owner, conversation, visitor } = await setupWithConversation();

    await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`)
      .set(auth(agent.token))
      .send({ content: 'SECRET internal note about this customer', type: 'INTERNAL_NOTE' })
      .expect(201);
    await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`)
      .set(auth(agent.token))
      .send({ content: 'Public reply' })
      .expect(201);

    const agentView = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}/messages`).set(auth(owner.token)).expect(200);
    const types = agentView.body.data.map((m) => m.type);
    expect(types).toContain('INTERNAL_NOTE');
    expect(agentView.body.data.find((m) => m.isInternalNote).content).toMatch(/SECRET/);

    const visitorView = await api()
      .get(`/api/v1/public/conversations/${conversation.id}/messages`)
      .set(visitorAuth(visitor.visitorToken))
      .expect(200);
    const raw = JSON.stringify(visitorView.body);
    expect(raw).not.toMatch(/SECRET/);
    expect(raw).not.toMatch(/INTERNAL_NOTE/);
    expect(visitorView.body.data.map((m) => m.type)).toEqual(expect.arrayContaining(['TEXT']));
    // Agent identity is limited to a display name.
    const agentMsg = visitorView.body.data.find((m) => m.senderType === 'USER');
    expect(agentMsg.agent).toEqual({ name: 'Agent', avatar: null });
    expect(agentMsg.sender).toBeUndefined();
  });

  it('a visitor cannot author an internal note (type is ignored)', async () => {
    const { workspace, owner, conversation, visitor } = await setupWithConversation();
    const res = await api()
      .post(`/api/v1/public/conversations/${conversation.id}/messages`)
      .set(visitorAuth(visitor.visitorToken))
      .send({ content: 'sneaky', type: 'INTERNAL_NOTE' })
      .expect(201);
    expect(res.body.data.message.type).toBe('TEXT');

    const agentView = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}/messages`).set(auth(owner.token)).expect(200);
    expect(agentView.body.data.every((m) => m.senderType !== 'VISITOR' || m.type !== 'INTERNAL_NOTE')).toBe(true);
  });

  it('cursor pagination walks history backwards without duplicates', async () => {
    const { workspace, owner, conversation, visitor } = await setupWithConversation();
    for (let i = 0; i < 7; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await api()
        .post(`/api/v1/public/conversations/${conversation.id}/messages`)
        .set(visitorAuth(visitor.visitorToken))
        .send({ content: `msg ${i}` })
        .expect(201);
    }
    const seen = new Set();
    let cursor = null;
    let pages = 0;
    do {
      // eslint-disable-next-line no-await-in-loop
      const res = await api()
        .get(`${ws(workspace.id)}/conversations/${conversation.id}/messages?limit=3${cursor ? `&cursor=${cursor}` : ''}`)
        .set(auth(owner.token))
        .expect(200);
      res.body.data.forEach((m) => {
        expect(seen.has(m.id)).toBe(false);
        seen.add(m.id);
      });
      cursor = res.body.meta.pagination.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);
    expect(seen.size).toBe(8); // 1 opening message + 7
  });

  it('read receipts clear unread counters on both sides', async () => {
    const { workspace, agent, conversation, visitor } = await setupWithConversation();
    let detail = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}`).set(auth(agent.token)).expect(200);
    expect(detail.body.data.agentUnreadCount).toBe(1);

    await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/read`).set(auth(agent.token)).expect(200);
    detail = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}`).set(auth(agent.token)).expect(200);
    expect(detail.body.data.agentUnreadCount).toBe(0);

    await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`).set(auth(agent.token)).send({ content: 'reply' }).expect(201);
    let v = await api().get(`/api/v1/public/conversations/${conversation.id}`).set(visitorAuth(visitor.visitorToken)).expect(200);
    expect(v.body.data.unreadCount).toBe(1);
    await api().post(`/api/v1/public/conversations/${conversation.id}/read`).set(visitorAuth(visitor.visitorToken)).expect(200);
    v = await api().get(`/api/v1/public/conversations/${conversation.id}`).set(visitorAuth(visitor.visitorToken)).expect(200);
    expect(v.body.data.unreadCount).toBe(0);
  });

  it('agents may edit only their own messages', async () => {
    const { workspace, agent, owner, conversation } = await setupWithConversation();
    const sent = await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`).set(auth(agent.token)).send({ content: 'typo' }).expect(201);
    await api()
      .patch(`${ws(workspace.id)}/conversations/${conversation.id}/messages/${sent.body.data.id}`)
      .set(auth(owner.token))
      .send({ content: 'fixed' })
      .expect(403);
    const edited = await api()
      .patch(`${ws(workspace.id)}/conversations/${conversation.id}/messages/${sent.body.data.id}`)
      .set(auth(agent.token))
      .send({ content: 'fixed' })
      .expect(200);
    expect(edited.body.data.editedAt).toBeTruthy();
  });
});
