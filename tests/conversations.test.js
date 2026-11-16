'use strict';

const { api, auth, visitorAuth, registerUser, addAgent, setupWithConversation } = require('./helpers/api');

const ws = (id) => `/api/v1/workspaces/${id}`;

describe('conversations: queue, claim, first-response assignment, lifecycle', () => {
  it('a new visitor conversation is unassigned and visible to owner and agent', async () => {
    const { workspace, owner, agent, conversation } = await setupWithConversation();
    expect(conversation.status).toBe('OPEN');

    for (const member of [owner, agent]) {
      // eslint-disable-next-line no-await-in-loop
      const res = await api().get(`${ws(workspace.id)}/conversations/unassigned`).set(auth(member.token)).expect(200);
      expect(res.body.data.map((c) => c.id)).toContain(conversation.id);
      expect(res.body.data[0].isAssigned).toBe(false);
      expect(res.body.meta.pagination.type).toBe('cursor');
    }

    const counts = await api().get(`${ws(workspace.id)}/conversations/counts`).set(auth(owner.token)).expect(200);
    expect(counts.body.data.unassigned).toBe(1);
  });

  it('claim is atomic: exactly one of many concurrent agents wins, the rest get 409 ALREADY_ASSIGNED', async () => {
    // The guarantee comes from MongoDB's atomic findOneAndUpdate. Emulators such
    // as FerretDB implement findAndModify as read-then-write and cannot honour
    // it, so the race assertion is only meaningful against real MongoDB.
    const mongoose = require('mongoose');
    const info = await mongoose.connection.db.admin().buildInfo();
    if (info.ferretdbVersion) {
      console.warn('Skipping atomic-claim race: not running against real MongoDB');
      return;
    }
    const { workspace, owner, agent, conversation } = await setupWithConversation();
    const extras = await Promise.all([1, 2, 3].map(() => registerUser()));
    await Promise.all(extras.map((e) => addAgent(workspace.id, e.user.id)));

    const contenders = [owner, agent, ...extras];
    const results = await Promise.all(
      contenders.map((c) => api().post(`${ws(workspace.id)}/conversations/${conversation.id}/claim`).set(auth(c.token))),
    );

    const winners = results.filter((r) => r.status === 200);
    const losers = results.filter((r) => r.status === 409);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(contenders.length - 1);
    losers.forEach((r) => expect(r.body.error.code).toBe('ALREADY_ASSIGNED'));

    const winnerId = winners[0].body.data.assignedTo.id;
    expect(contenders.map((c) => c.user.id)).toContain(winnerId);

    // Re-claiming by the winner is idempotent, not an error.
    const winner = contenders.find((c) => c.user.id === winnerId);
    const again = await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/claim`).set(auth(winner.token)).expect(200);
    expect(again.body.meta.claimed).toBe(false);

    // And the queue is empty now.
    const queue = await api().get(`${ws(workspace.id)}/conversations/unassigned`).set(auth(owner.token)).expect(200);
    expect(queue.body.data).toHaveLength(0);
  });

  it('the first agent reply implicitly claims the conversation and sets firstResponseAt', async () => {
    const { workspace, agent, owner, conversation } = await setupWithConversation();

    const reply = await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`)
      .set(auth(agent.token))
      .send({ content: 'Hi! How can I help?' })
      .expect(201);
    expect(reply.body.meta.claimed).toBe(true);

    const detail = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}`).set(auth(owner.token)).expect(200);
    expect(detail.body.data.assignedTo.id).toBe(agent.user.id);
    expect(detail.body.data.firstResponseAt).toBeTruthy();

    // A later reply by the owner does NOT steal the assignment.
    const second = await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`)
      .set(auth(owner.token))
      .send({ content: 'Owner chiming in' })
      .expect(201);
    expect(second.body.meta.claimed).toBe(false);
    const after = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}`).set(auth(owner.token)).expect(200);
    expect(after.body.data.assignedTo.id).toBe(agent.user.id);
  });

  it('an internal note does not claim the conversation', async () => {
    const { workspace, agent, owner, conversation } = await setupWithConversation();
    await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`)
      .set(auth(agent.token))
      .send({ content: 'checking the account', type: 'INTERNAL_NOTE' })
      .expect(201);
    const detail = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}`).set(auth(owner.token)).expect(200);
    expect(detail.body.data.assignedTo).toBeNull();
    expect(detail.body.data.firstResponseAt).toBeNull();
  });

  it('owner can assign to another agent; agents cannot assign others', async () => {
    const { workspace, agent, owner, conversation } = await setupWithConversation();
    const other = await registerUser();
    await addAgent(workspace.id, other.user.id);

    const forbidden = await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/assign`)
      .set(auth(agent.token))
      .send({ userId: other.user.id })
      .expect(403);
    expect(forbidden.body.error.code).toBe('INSUFFICIENT_PERMISSION');

    const ok = await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/assign`)
      .set(auth(owner.token))
      .send({ userId: other.user.id })
      .expect(200);
    expect(ok.body.data.assignedTo.id).toBe(other.user.id);

    // Assigning to a non-member is rejected.
    const outsider = await registerUser();
    await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/assign`)
      .set(auth(owner.token))
      .send({ userId: outsider.user.id })
      .expect(404);
  });

  it('close is idempotent, reopen restores OPEN, and the visitor is told', async () => {
    const { workspace, agent, owner, conversation, visitor } = await setupWithConversation();
    await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/claim`).set(auth(agent.token)).expect(200);

    const closed = await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/close`).set(auth(agent.token)).send({}).expect(200);
    expect(closed.body.data.status).toBe('CLOSED');
    expect(closed.body.meta.changed).toBe(true);

    const again = await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/close`).set(auth(agent.token)).send({}).expect(200);
    expect(again.body.meta.changed).toBe(false);

    // Agent cannot reply to a closed conversation.
    await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`)
      .set(auth(agent.token))
      .send({ content: 'x' })
      .expect(400);

    const asVisitor = await api().get(`/api/v1/public/conversations/${conversation.id}`).set(visitorAuth(visitor.visitorToken)).expect(200);
    expect(asVisitor.body.data.status).toBe('CLOSED');

    const reopened = await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/reopen`).set(auth(owner.token)).expect(200);
    expect(reopened.body.data.status).toBe('OPEN');
    expect(reopened.body.data.closedAt).toBeNull();
  });

  it('an agent cannot close a conversation assigned to someone else', async () => {
    const { workspace, agent, owner, conversation } = await setupWithConversation();
    await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/claim`).set(auth(owner.token)).expect(200);
    await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/close`).set(auth(agent.token)).send({}).expect(403);
  });

  it('tags: owner manages the catalogue, agents apply them, duplicates rejected', async () => {
    const { workspace, agent, owner, conversation } = await setupWithConversation();

    await api().post(`${ws(workspace.id)}/tags`).set(auth(agent.token)).send({ name: 'Billing' }).expect(403);
    const tag = await api().post(`${ws(workspace.id)}/tags`).set(auth(owner.token)).send({ name: 'Billing', color: '#f59e0b' }).expect(201);
    const dup = await api().post(`${ws(workspace.id)}/tags`).set(auth(owner.token)).send({ name: 'billing' }).expect(409);
    expect(dup.body.error.code).toBe('ALREADY_EXISTS');

    const tagged = await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/tags/${tag.body.data.id}`)
      .set(auth(agent.token))
      .expect(200);
    expect(tagged.body.data.tags.map((t) => t.name)).toEqual(['Billing']);

    const filtered = await api().get(`${ws(workspace.id)}/conversations?tagId=${tag.body.data.id}`).set(auth(agent.token)).expect(200);
    expect(filtered.body.data).toHaveLength(1);

    await api().delete(`${ws(workspace.id)}/tags/${tag.body.data.id}`).set(auth(owner.token)).expect(200);
    const after = await api().get(`${ws(workspace.id)}/conversations/${conversation.id}`).set(auth(owner.token)).expect(200);
    expect(after.body.data.tags).toEqual([]);
  });
});
