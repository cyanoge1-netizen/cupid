import { describe, it, expect } from 'vitest';
import { bn } from './i18n/bn';

describe('Sanity test', () => {
  it('loads bn i18n correctly', () => {
    expect(bn.appName).toBe('ঘটকালি');
  });
});
