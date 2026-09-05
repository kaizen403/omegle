import { redactLogMetadata } from './logger';

describe('redactLogMetadata', () => {
  it('replaces secret-like keys with a length marker', () => {
    expect(
      redactLogMetadata({
        apiKey: 'super-secret-value',
        resumeToken: 'abc',
        userId: 42,
      })
    ).toEqual({
      apiKey: '[redacted len=18]',
      resumeToken: '[redacted len=3]',
      userId: 42,
    });
  });

  it('redacts nested tokens without dropping sibling fields', () => {
    expect(
      redactLogMetadata({
        handshake: { auth: { apiKey: 'k', name: 'Ada' }, ip: '203.0.113.5' },
      })
    ).toEqual({
      handshake: { auth: { apiKey: '[redacted len=1]', name: 'Ada' }, ip: '203.0.113.5' },
    });
  });
});
