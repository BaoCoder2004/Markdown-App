import { getSnippet } from './text.util';

describe('text.util', () => {
  it('should return "No content" for empty string or undefined', () => {
    expect(getSnippet('')).toBe('No content');
    expect(getSnippet(undefined)).toBe('No content');
  });

  it('should strip markdown characters and return plain snippet', () => {
    const md = '# Header\n**Bold** text with `code` and [link]';
    const result = getSnippet(md);
    expect(result).not.toContain('#');
    expect(result).not.toContain('*');
    expect(result).not.toContain('`');
  });

  it('should truncate snippet if length exceeds maxLength', () => {
    const longText = 'This is a very long line of text that should be truncated by getSnippet function.';
    const result = getSnippet(longText, 20);
    expect(result.length).toBe(23); // 20 + '...'
    expect(result.endsWith('...')).toBe(true);
  });
});

