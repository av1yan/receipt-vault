import { errMsg, toSession } from '../lib/authParse';

describe('toSession', () => {
  const full = {
    access_token: 'acc',
    refresh_token: 'ref',
    user: { id: 'u1', email: 'a@b.com' },
  };

  it('maps a complete payload', () => {
    expect(toSession(full)).toEqual({
      accessToken: 'acc',
      refreshToken: 'ref',
      email: 'a@b.com',
      userId: 'u1',
    });
  });

  it('defaults a missing refresh token to empty string', () => {
    expect(toSession({ access_token: 'acc', user: { id: 'u1', email: 'a@b.com' } }).refreshToken).toBe('');
  });

  it('defaults a missing email to empty string', () => {
    expect(toSession({ access_token: 'acc', user: { id: 'u1' } }).email).toBe('');
  });

  it.each([
    ['missing access_token', { user: { id: 'u1' } }],
    ['missing user', { access_token: 'acc' }],
    ['missing user.id', { access_token: 'acc', user: { email: 'a@b.com' } }],
    ['empty object', {}],
    ['null', null],
    ['undefined', undefined],
  ])('returns null for %s', (_label, data) => {
    expect(toSession(data)).toBeNull();
  });
});

describe('errMsg', () => {
  it('falls back when nothing usable is present', () => {
    expect(errMsg({}, 'fallback')).toBe('fallback');
    expect(errMsg(null, 'fallback')).toBe('fallback');
  });

  it('reads each field when it is the only one present', () => {
    expect(errMsg({ error_description: 'ed' }, 'fb')).toBe('ed');
    expect(errMsg({ msg: 'm' }, 'fb')).toBe('m');
    expect(errMsg({ message: 'msg' }, 'fb')).toBe('msg');
    expect(errMsg({ error: 'e' }, 'fb')).toBe('e');
  });

  it('prefers error_description > msg > message > error', () => {
    expect(errMsg({ error_description: 'ed', msg: 'm', message: 'msg', error: 'e' }, 'fb')).toBe('ed');
    expect(errMsg({ msg: 'm', message: 'msg', error: 'e' }, 'fb')).toBe('m');
    expect(errMsg({ message: 'msg', error: 'e' }, 'fb')).toBe('msg');
  });
});
