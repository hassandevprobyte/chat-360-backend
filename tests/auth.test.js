'use strict';

const { api, auth, registerUser, PASSWORD } = require('./helpers/api');

describe('auth', () => {
  it('registers, returns tokens, and loads /me', async () => {
    const { user, token } = await registerUser();
    expect(user.email).toMatch(/@example\.com$/);
    const me = await api().get('/api/v1/me').set(auth(token)).expect(200);
    expect(me.body.data.user.id).toBe(user.id);
  });

  it('rejects duplicate registration with 409', async () => {
    const { email } = await registerUser();
    const res = await api().post('/api/v1/auth/register').send({ name: 'Dup', email, password: PASSWORD }).expect(409);
    expect(res.body.error.code).toBe('ALREADY_EXISTS');
  });

  it('validates input (422) and rejects bad credentials identically', async () => {
    const bad = await api().post('/api/v1/auth/register').send({ name: 'x', email: 'no', password: 'short' }).expect(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');

    const { email } = await registerUser();
    const wrong = await api().post('/api/v1/auth/login').send({ email, password: 'WrongPassword123' }).expect(401);
    const unknown = await api().post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: PASSWORD }).expect(401);
    expect(wrong.body.error.code).toBe(unknown.body.error.code);
  });

  it('logs in, refreshes with rotation, and detects refresh-token reuse', async () => {
    const { email } = await registerUser();
    const login = await api().post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    const first = login.body.data.refreshToken;

    const rotated = await api().post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    expect(rotated.body.data.accessToken).toBeTruthy();
    const second = rotated.body.data.refreshToken;
    expect(second).not.toBe(first);

    // Replaying the first token is reuse: the whole family is revoked.
    await api().post('/api/v1/auth/refresh').send({ refreshToken: first }).expect(401);
    await api().post('/api/v1/auth/refresh').send({ refreshToken: second }).expect(401);
  });

  it('rejects requests without a token', async () => {
    await api().get('/api/v1/me').expect(401);
    await api().get('/api/v1/workspaces').expect(401);
  });
});
