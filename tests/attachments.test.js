'use strict';

const { api, auth, visitorAuth, setupWithConversation, initVisitor } = require('./helpers/api');

const ws = (id) => `/api/v1/workspaces/${id}`;
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

describe('attachments', () => {
  it('validates MIME type, extension agreement and size', async () => {
    const { workspace, agent } = await setupWithConversation();
    const url = `${ws(workspace.id)}/attachments`;

    const badType = await api().post(url).set(auth(agent.token)).attach('file', Buffer.from('<html>'), { filename: 'x.html', contentType: 'text/html' });
    expect(badType.status).toBe(415);

    const mismatch = await api().post(url).set(auth(agent.token)).attach('file', png, { filename: 'x.exe', contentType: 'image/png' });
    expect(mismatch.status).toBe(415);

    const tooBig = await api().post(url).set(auth(agent.token)).attach('file', Buffer.alloc(11 * 1024 * 1024), { filename: 'big.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(413);

    const noFile = await api().post(url).set(auth(agent.token)).field('x', 'y');
    expect(noFile.status).toBe(400);
  });

  it('agent uploads, sends, and downloads; storage key is never exposed', async () => {
    const { workspace, agent, conversation, visitor, widget: { publicKey } } = await setupWithConversation();

    const up = await api().post(`${ws(workspace.id)}/attachments`).set(auth(agent.token)).attach('file', png, { filename: 'shot.png', contentType: 'image/png' }).expect(201);
    expect(up.body.data.downloadUrl).toMatch(/\/api\/v1\/workspaces\/.+\/attachments\/.+\/download$/);
    expect(JSON.stringify(up.body)).not.toMatch(/storageKey|workspaces\/[0-9a-f]{24}\/20/);

    const sent = await api()
      .post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`)
      .set(auth(agent.token))
      .send({ attachmentIds: [up.body.data.id] })
      .expect(201);
    expect(sent.body.data.type).toBe('IMAGE');

    // Sending the same upload twice is refused.
    await api().post(`${ws(workspace.id)}/conversations/${conversation.id}/messages`).set(auth(agent.token)).send({ attachmentIds: [up.body.data.id] }).expect(400);

    const dl = await api().get(`${ws(workspace.id)}/attachments/${up.body.data.id}/download`).set(auth(agent.token)).expect(200);
    expect(dl.headers['content-disposition']).toMatch(/^attachment;/);
    expect(dl.headers['x-content-type-options']).toBe('nosniff');

    // The visitor of that conversation can download it via the public route...
    await api().get(`/api/v1/public/attachments/${up.body.data.id}/download`).set(visitorAuth(visitor.visitorToken)).expect(200);
    // ...but a different visitor cannot (even one on the same widget).
    const stranger = await initVisitor(publicKey);
    await api().get(`/api/v1/public/attachments/${up.body.data.id}/download`).set(visitorAuth(stranger.visitorToken)).expect(404);
  });

  it('a visitor cannot attach another uploader\'s file, and uploads respect the widget setting', async () => {
    const { workspace, agent, owner, widget, conversation, visitor } = await setupWithConversation();
    const agentUpload = await api().post(`${ws(workspace.id)}/attachments`).set(auth(agent.token)).attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(201);

    await api()
      .post(`/api/v1/public/conversations/${conversation.id}/messages`)
      .set(visitorAuth(visitor.visitorToken))
      .send({ attachmentIds: [agentUpload.body.data.id] })
      .expect(404);

    const visitorUpload = await api().post('/api/v1/public/attachments').set(visitorAuth(visitor.visitorToken)).attach('file', png, { filename: 'v.png', contentType: 'image/png' }).expect(201);
    expect(JSON.stringify(visitorUpload.body)).not.toContain(workspace.id);
    await api()
      .post(`/api/v1/public/conversations/${conversation.id}/messages`)
      .set(visitorAuth(visitor.visitorToken))
      .send({ attachmentIds: [visitorUpload.body.data.id] })
      .expect(201);

    await api().patch(`${ws(workspace.id)}/widgets/${widget.id}`).set(auth(owner.token)).send({ settings: { fileUploadEnabled: false } }).expect(200);
    await api().post('/api/v1/public/attachments').set(visitorAuth(visitor.visitorToken)).attach('file', png, { filename: 'v.png', contentType: 'image/png' }).expect(400);
  });
});
