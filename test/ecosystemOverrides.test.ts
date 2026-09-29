import { describe, expect, it } from 'vitest';
import { isEcosystemEnabled, setEcosystemEnabled, type EcosystemOverrides } from '../src/shared/api.js';

const node = { ecosystem: 'Node.js', defaultEnabled: true };
const composer = { ecosystem: 'Composer', defaultEnabled: false };
const none: EcosystemOverrides = { disabledEcosystems: [], enabledEcosystems: [] };

describe('ecosystem overrides', () => {
  it('uses each ecosystem default when there are no overrides', () => {
    expect(isEcosystemEnabled(node, none)).toBe(true);
    expect(isEcosystemEnabled(composer, none)).toBe(false);
  });

  it('records turning a default-on ecosystem off, and clears it when turned back on', () => {
    const off = setEcosystemEnabled(node, none, false);
    expect(off).toEqual({ disabledEcosystems: ['Node.js'], enabledEcosystems: [] });
    expect(setEcosystemEnabled(node, off, true)).toEqual(none);
  });

  it('records turning a default-off ecosystem on, and clears it when turned back off', () => {
    const on = setEcosystemEnabled(composer, none, true);
    expect(on).toEqual({ disabledEcosystems: [], enabledEcosystems: ['Composer'] });
    expect(isEcosystemEnabled(composer, on)).toBe(true);
    expect(setEcosystemEnabled(composer, on, false)).toEqual(none);
  });
});
