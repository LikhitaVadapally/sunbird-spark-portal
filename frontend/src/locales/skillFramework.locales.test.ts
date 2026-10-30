import { describe, it, expect } from 'vitest';
import en from './en.json';
import fr from './fr.json';
import pt from './pt.json';
import ar from './ar.json';

/** Guards against locale drift for the Skill Framework admin tab (userManagement.skillFramework). */
const flatKeys = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatKeys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

describe('userManagement.skillFramework locale parity', () => {
  const locales = { en, fr, pt, ar } as Record<string, { userManagement: Record<string, unknown> }>;
  const enKeys = flatKeys(en.userManagement.skillFramework).sort();

  it.each(Object.entries(locales))('%s has the same skillFramework keys as en', (_name, locale) => {
    const ns = locale.userManagement.skillFramework as Record<string, unknown> | undefined;
    expect(ns).toBeDefined();
    expect(flatKeys(ns ?? {}).sort()).toEqual(enKeys);
  });

  it.each(Object.entries(locales))('%s has the Skill Framework tab label', (_name, locale) => {
    expect((locale.userManagement.tabs as Record<string, string>).skillFramework).toBeTruthy();
  });
});
