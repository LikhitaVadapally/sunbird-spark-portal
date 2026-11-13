import { describe, it, expect } from 'vitest';
import { levelCodeFromName, levelErrors, levelsValid, MAX_LEVELS } from './frameworkLevels';

const lv = (code: string, name = code) => ({ code, name });

describe('levelCodeFromName', () => {
  it('lowercases and drops spaces, symbols and leading digits', () => {
    expect(levelCodeFromName('Competency Area')).toBe('competencyarea');
    expect(levelCodeFromName('3D Cuisine!')).toBe('dcuisine');
  });
});

describe('levelErrors', () => {
  it('accepts the defaults and a custom last level', () => {
    expect(levelErrors([lv('competencyarea'), lv('competency'), lv('skill')])).toEqual([undefined, undefined, undefined]);
    expect(levelErrors([lv('technique'), lv('cuisine')])).toEqual([undefined, undefined]);
  });

  it('flags empty, malformed, reserved and repeated codes', () => {
    expect(levelErrors([lv('', 'Area')])).toEqual(['empty']);
    expect(levelErrors([lv('area', ' ')])).toEqual(['empty']);
    expect(levelErrors([lv('my-level')])).toEqual(['invalid']);
    expect(levelErrors([lv('1area')])).toEqual(['invalid']);
    // A course's own field: skills saved there would overwrite its curriculum value.
    expect(levelErrors([lv('subject'), lv('gradeLevel')])).toEqual(['reserved', 'reserved']);
    expect(levelErrors([lv('cuisine'), lv('cuisine', 'Cuisine 2')])).toEqual(['duplicate', 'duplicate']);
  });
});

describe('levelsValid', () => {
  it('needs 1 to MAX_LEVELS valid levels', () => {
    expect(levelsValid([])).toBe(false);
    expect(levelsValid([lv('cuisine')])).toBe(true);
    expect(levelsValid(Array.from({ length: MAX_LEVELS + 1 }, (_, i) => lv(`l${i}`)))).toBe(false);
    expect(levelsValid([lv('subject')])).toBe(false);
  });
});
