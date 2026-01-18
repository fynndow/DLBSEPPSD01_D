import { describe, expect, it } from 'vitest';
import { generateShortCode } from '../src/utils/shortCode';

describe('shortCode utils', () => {
  it('generates a default 7 character code', () => {
    const code = generateShortCode();
    expect(code).toHaveLength(7);
    expect(code).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('generates a code with the requested length', () => {
    const code = generateShortCode(10);
    expect(code).toHaveLength(10);
  });
});
