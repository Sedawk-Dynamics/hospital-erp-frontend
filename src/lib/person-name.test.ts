import { describe, it, expect } from 'vitest';
import { fullName, initials } from './person-name';

/**
 * A temporary patient is created with a first name and nothing else — that is
 * the point of the flow, for someone who arrives unable to give their details.
 * `${firstName} ${lastName}` stringifies the missing surname, so the IP list
 * read "TEMPORARY 5 NULL": not an absent name, but what looks like corrupt data.
 */

describe('joining a name', () => {
  it('drops a missing surname instead of printing "null"', () => {
    expect(fullName({ firstName: 'Temporary 5', lastName: null })).toBe('Temporary 5');
    expect(fullName({ firstName: 'Temporary 5', lastName: undefined })).toBe('Temporary 5');
  });

  it('survives being uppercased, which is where it was most obvious', () => {
    expect(fullName({ firstName: 'Temporary 5', lastName: null }).toUpperCase()).toBe('TEMPORARY 5');
  });

  it('joins both parts when there are two', () => {
    expect(fullName({ firstName: 'Asha', lastName: 'Menon' })).toBe('Asha Menon');
  });

  it('handles a surname with no first name', () => {
    expect(fullName({ firstName: null, lastName: 'Menon' })).toBe('Menon');
  });

  it('treats whitespace as absent, so a blank field does not leave a stray space', () => {
    expect(fullName({ firstName: 'Asha', lastName: '   ' })).toBe('Asha');
    expect(fullName({ firstName: '  ', lastName: '  ' }, 'Unknown')).toBe('Unknown');
  });

  it('falls back rather than rendering an empty row', () => {
    expect(fullName(null, 'Unknown')).toBe('Unknown');
    expect(fullName(undefined, 'Patient')).toBe('Patient');
    expect(fullName({}, 'Unknown')).toBe('Unknown');
  });

  it('returns an empty string when no fallback is asked for', () => {
    expect(fullName({})).toBe('');
  });
});

describe('initials', () => {
  it('uses both when there are two', () => {
    expect(initials({ firstName: 'Asha', lastName: 'Menon' })).toBe('AM');
  });

  it('uses one when that is all there is, rather than an empty circle', () => {
    expect(initials({ firstName: 'Temporary 5', lastName: null })).toBe('T');
  });

  it('falls back to a character, never to nothing', () => {
    expect(initials(null)).toBe('?');
    expect(initials({ firstName: '  ' })).toBe('?');
  });
});
