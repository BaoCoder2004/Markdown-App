import { formatRelativeTime } from './date.util';

describe('date.util', () => {
  it('should return empty string for undefined timestamp', () => {
    expect(formatRelativeTime(undefined)).toBe('');
  });

  it('should return "Just now" for current time', () => {
    expect(formatRelativeTime(Date.now())).toBe('Just now');
  });

  it('should return relative minutes for past time within an hour', () => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    expect(formatRelativeTime(tenMinutesAgo)).toContain('minute');
  });
});

