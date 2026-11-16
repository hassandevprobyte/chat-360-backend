'use strict';

// dns.lookup / dns.resolveTxt are mocked so the suite never makes real network
// or DNS calls. Every test that reaches a checker must first stub a public IP
// via lookup - assertPublicHostname runs before every DNS/HTTP check.
jest.mock('node:dns', () => ({
  promises: {
    lookup: jest.fn(),
    resolveTxt: jest.fn(),
  },
}));

const dns = require('node:dns').promises;
const { api, auth, setupWorkspace } = require('./helpers/api');

const PUBLIC_IP = { address: '93.184.216.34', family: 4 };

function mockPublicLookup() {
  dns.lookup.mockResolvedValue([PUBLIC_IP]);
}

function mockFetchOnce(body, { ok = true, status = 200 } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    body: {
      getReader: () => {
        let done = false;
        return {
          read: async () => {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: Buffer.from(body, 'utf8') };
          },
          cancel: async () => {},
        };
      },
    },
  });
}

describe('website domain verification', () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('issues a token on first read and exposes instructions for all three methods', async () => {
    const { owner, workspace, website } = await setupWorkspace();

    const res = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);

    expect(res.body.data.token).toMatch(/^[a-f0-9]{40}$/);
    expect(res.body.data.status).toBe('UNVERIFIED');
    expect(res.body.data.methods.DNS_TXT.value).toBe(`livechat-site-verification=${res.body.data.token}`);
    expect(res.body.data.methods.META_TAG.tag).toContain(res.body.data.token);
    expect(res.body.data.methods.FILE_UPLOAD.url).toBe(`https://${website.domain}/${res.body.data.methods.FILE_UPLOAD.fileName}`);

    // Calling it again returns the same token rather than minting a new one.
    const again = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);
    expect(again.body.data.token).toBe(res.body.data.token);
  });

  it('verifies via a matching DNS TXT record', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    const instructions = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);
    const { token } = instructions.body.data;

    mockPublicLookup();
    dns.resolveTxt.mockResolvedValue([['some-other-record'], [`livechat-site-verification=${token}`]]);

    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'DNS_TXT' })
      .expect(200);

    expect(res.body.data.verificationStatus).toBe('VERIFIED');
    expect(res.body.data.verificationMethod).toBe('DNS_TXT');
    expect(res.body.data.verifiedAt).toBeTruthy();
  });

  it('fails DNS verification when no TXT record matches, and records why', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);

    mockPublicLookup();
    dns.resolveTxt.mockResolvedValue([['unrelated=value']]);

    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'DNS_TXT' })
      .expect(400);
    expect(res.body.error.code).toBe('VERIFICATION_FAILED');

    const after = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}`)
      .set(auth(owner.token))
      .expect(200);
    expect(after.body.data.verificationStatus).toBe('FAILED');
    expect(after.body.data.lastVerificationError).toMatch(/No TXT record/);
  });

  it('verifies via a matching meta tag on the homepage', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    const instructions = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);
    const { token } = instructions.body.data;

    mockPublicLookup();
    mockFetchOnce(`<html><head><meta name="livechat-site-verification" content="${token}" /></head></html>`);

    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'META_TAG' })
      .expect(200);

    expect(res.body.data.verificationStatus).toBe('VERIFIED');
    expect(res.body.data.verificationMethod).toBe('META_TAG');
  });

  it('verifies via a matching uploaded file', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    const instructions = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);
    const { token } = instructions.body.data;

    mockPublicLookup();
    mockFetchOnce(`${token}\n`); // trailing newline should still match after trim()

    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'FILE_UPLOAD' })
      .expect(200);

    expect(res.body.data.verificationStatus).toBe('VERIFIED');
    expect(res.body.data.verificationMethod).toBe('FILE_UPLOAD');
  });

  it('fails file verification when the content does not match', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);

    mockPublicLookup();
    mockFetchOnce('not-the-token');

    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'FILE_UPLOAD' })
      .expect(400);
    expect(res.body.error.code).toBe('VERIFICATION_FAILED');
  });

  it('refuses to check a domain that resolves to a private address (SSRF guard)', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);

    dns.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'META_TAG' })
      .expect(400);
    expect(res.body.error.code).toBe('VERIFICATION_FAILED');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('is idempotent once verified: re-verifying does not hit the network again', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    const instructions = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);
    const { token } = instructions.body.data;

    mockPublicLookup();
    dns.resolveTxt.mockResolvedValue([[`livechat-site-verification=${token}`]]);
    await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'DNS_TXT' })
      .expect(200);

    dns.resolveTxt.mockClear();
    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'META_TAG' })
      .expect(200);
    expect(res.body.data.verificationStatus).toBe('VERIFIED');
    expect(dns.resolveTxt).not.toHaveBeenCalled();
  });

  it('rotating the token resets status and invalidates the old token', async () => {
    const { owner, workspace, website } = await setupWorkspace();
    const first = await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(owner.token))
      .expect(200);

    const rotated = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification/rotate`)
      .set(auth(owner.token))
      .expect(200);

    expect(rotated.body.data.token).not.toBe(first.body.data.token);
    expect(rotated.body.data.status).toBe('UNVERIFIED');

    mockPublicLookup();
    dns.resolveTxt.mockResolvedValue([[`livechat-site-verification=${first.body.data.token}`]]);
    const res = await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'DNS_TXT' })
      .expect(400);
    expect(res.body.error.code).toBe('VERIFICATION_FAILED');
  });

  it('an agent can read instructions but not rotate the token or verify', async () => {
    const { agent, workspace, website } = await setupWorkspace();

    await api()
      .get(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification`)
      .set(auth(agent.token))
      .expect(200);

    await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verification/rotate`)
      .set(auth(agent.token))
      .expect(403);

    await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(agent.token))
      .send({ method: 'DNS_TXT' })
      .expect(403);
  });

  it('rejects an unknown verification method and a malformed websiteId', async () => {
    const { owner, workspace, website } = await setupWorkspace();

    await api()
      .post(`/api/v1/workspaces/${workspace.id}/websites/${website.id}/verify`)
      .set(auth(owner.token))
      .send({ method: 'CARRIER_PIGEON' })
      .expect(422);

    await api()
      .get('/api/v1/workspaces/' + workspace.id + '/websites/not-an-id/verification')
      .set(auth(owner.token))
      .expect(422);
  });
});
