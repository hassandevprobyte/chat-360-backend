'use strict';

const { api, auth, setupWorkspace, createWorkspace } = require('./helpers/api');

const path = (wsId) => `/api/v1/workspaces/${wsId}/message-shortcuts`;

describe('message shortcuts', () => {
  it('CRUD for the owner of the shortcut; trigger normalised, list sorted', async () => {
    const { workspace, agent } = await setupWorkspace();

    const created = await api().post(path(workspace.id)).set(auth(agent.token)).send({ shortcut: '/Pricing', content: 'Our plans start at $10.' }).expect(201);
    expect(created.body.data.shortcut).toBe('pricing');
    expect(created.body.data.trigger).toBe('/pricing');

    await api().post(path(workspace.id)).set(auth(agent.token)).send({ shortcut: 'brb', content: 'One moment' }).expect(201);

    const list = await api().get(`${path(workspace.id)}?all=true`).set(auth(agent.token)).expect(200);
    expect(list.body.data.map((s) => s.shortcut)).toEqual(['brb', 'pricing']);

    const updated = await api().patch(`${path(workspace.id)}/${created.body.data.id}`).set(auth(agent.token)).send({ content: 'Updated' }).expect(200);
    expect(updated.body.data.content).toBe('Updated');

    await api().delete(`${path(workspace.id)}/${created.body.data.id}`).set(auth(agent.token)).expect(200);
    await api().get(`${path(workspace.id)}/${created.body.data.id}`).set(auth(agent.token)).expect(404);
  });

  it('uniqueness is per user per workspace; the same trigger in another workspace or user is fine', async () => {
    const { workspace, agent, owner } = await setupWorkspace();
    await api().post(path(workspace.id)).set(auth(agent.token)).send({ shortcut: 'hi', content: 'a' }).expect(201);
    const dup = await api().post(path(workspace.id)).set(auth(agent.token)).send({ shortcut: '/HI', content: 'b' }).expect(409);
    expect(dup.body.error.code).toBe('ALREADY_EXISTS');

    // Same trigger, different user, same workspace -> ok.
    await api().post(path(workspace.id)).set(auth(owner.token)).send({ shortcut: 'hi', content: 'owner version' }).expect(201);

    // Same trigger, same user, different workspace -> ok.
    const other = await createWorkspace(owner.token, 'Second');
    await api().post(path(other.id)).set(auth(owner.token)).send({ shortcut: 'hi', content: 'second ws' }).expect(201);
  });

  it('shortcuts are private: other members cannot read, edit or delete them', async () => {
    const { workspace, agent, owner } = await setupWorkspace();
    const mine = await api().post(path(workspace.id)).set(auth(agent.token)).send({ shortcut: 'secret', content: 'agent only' }).expect(201);

    const ownerList = await api().get(`${path(workspace.id)}?all=true`).set(auth(owner.token)).expect(200);
    expect(ownerList.body.data).toHaveLength(0);

    await api().get(`${path(workspace.id)}/${mine.body.data.id}`).set(auth(owner.token)).expect(404);
    await api().patch(`${path(workspace.id)}/${mine.body.data.id}`).set(auth(owner.token)).send({ content: 'x' }).expect(404);
    await api().delete(`${path(workspace.id)}/${mine.body.data.id}`).set(auth(owner.token)).expect(404);
  });

  it('rejects invalid triggers and empty content', async () => {
    const { workspace, agent } = await setupWorkspace();
    await api().post(path(workspace.id)).set(auth(agent.token)).send({ shortcut: 'has space', content: 'x' }).expect(400);
    await api().post(path(workspace.id)).set(auth(agent.token)).send({ shortcut: 'ok', content: '' }).expect(422);
  });
});
