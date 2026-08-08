// Semantics of the local recent-players list behind /new's suggestion chips.
//
// The two behaviours worth guarding are the ones a casual refactor would get
// wrong: case-insensitive dedupe on insert (without rewriting the spelling the
// operator typed), and the exclusion rule that makes a chip row collapse on
// its own once its field holds a known name — that's what lets PlayerChips
// avoid focus tracking and the blur-before-tap race it would bring.

import { describe, expect, it } from 'vitest';
import {
  RECENT_PLAYERS_CAP,
  addRecentNames,
  isNameList,
  namesInPlay,
  normalizeNames,
  removeName,
  suggestNames,
} from '../recent-players';

// The rule both writers (/new's createMatch, /m/[id]'s onMetaUpdate) share.
// Getting it wrong doesn't throw — it quietly files people who never played,
// which is the one thing a list of "your regulars" must not do.
describe('namesInPlay', () => {
  const quad: [string, string, string, string] = [
    'Alice',
    'Bob',
    'Carol',
    'Dave',
  ];
  const pair: [string, string] = ['Alice', 'Carol'];

  it('takes all four in doubles', () => {
    expect(namesInPlay(true, quad, pair)).toEqual(quad);
  });

  it('ignores the partner slots in singles', () => {
    // /new leaves stale partners in its refs after a Doubles → Singles flip;
    // SettingsSheet leaves `players` at whatever creation wrote. Same guard.
    expect(namesInPlay(false, quad, pair)).toEqual(['Alice', 'Carol']);
  });
});

describe('normalizeNames', () => {
  it('trims, drops blanks, and caps', () => {
    expect(normalizeNames(['  Alice ', '', '   ', 'Bob'])).toEqual([
      'Alice',
      'Bob',
    ]);
    const many = Array.from({ length: 40 }, (_, i) => `P${i}`);
    expect(normalizeNames(many)).toHaveLength(RECENT_PLAYERS_CAP);
  });

  it('collapses case-insensitive duplicates, keeping the most recent spelling', () => {
    expect(normalizeNames(['baljeet', 'Baljeet', 'BALJEET'])).toEqual([
      'baljeet',
    ]);
  });
});

describe('addRecentNames', () => {
  it('puts the new batch in front of the existing list', () => {
    expect(addRecentNames(['Carol', 'Dave'], ['Alice', 'Bob'])).toEqual([
      'Alice',
      'Bob',
      'Carol',
      'Dave',
    ]);
  });

  it('re-typing an existing name promotes it rather than duplicating it', () => {
    expect(addRecentNames(['Carol', 'Baljeet'], ['baljeet'])).toEqual([
      'baljeet',
      'Carol',
    ]);
  });

  it('drops the blank partner slots a singles match leaves behind', () => {
    expect(addRecentNames([], ['Alice', '', 'Bob', ''])).toEqual([
      'Alice',
      'Bob',
    ]);
  });
});

describe('suggestNames', () => {
  const list = ['Baljeet Singh', 'Ankit', 'Ravi', 'Ravina', 'Bala'];

  it('offers everything when the field is empty', () => {
    expect(suggestNames(list, '', [])).toEqual(list);
  });

  it('matches a prefix of any word in the name', () => {
    expect(suggestNames(list, 'si', [])).toEqual(['Baljeet Singh']);
    expect(suggestNames(list, 'bal', [])).toEqual(['Baljeet Singh', 'Bala']);
  });

  it('does not match mid-word, so short queries stay useful', () => {
    expect(suggestNames(list, 'vi', [])).toEqual([]);
  });

  it('hides names already used elsewhere in the match', () => {
    expect(suggestNames(list, '', ['ankit', 'Ravi'])).toEqual([
      'Baljeet Singh',
      'Ravina',
      'Bala',
    ]);
  });

  // The collapse rule. `exclude` always carries the field's own value, so an
  // exactly-matched field offers nothing and PlayerChips renders no row.
  it('collapses to empty once the field holds an exact known name', () => {
    expect(suggestNames(list, 'Ankit', ['Ankit'])).toEqual([]);
  });

  it('still suggests longer names while a novel prefix is being typed', () => {
    expect(suggestNames(list, 'Ravi', ['Ravi'])).toEqual(['Ravina']);
  });
});

describe('removeName', () => {
  it('drops the name and leaves order otherwise intact', () => {
    expect(removeName(['Alice', 'Bob', 'Carol'], 'Bob')).toEqual([
      'Alice',
      'Carol',
    ]);
  });

  it('matches case-insensitively, so a variant behind the chip goes too', () => {
    expect(removeName(['Alice', 'baljeet', 'Baljeet'], 'BALJEET')).toEqual([
      'Alice',
    ]);
  });

  it('is a no-op for a name that is not there', () => {
    expect(removeName(['Alice'], 'Bob')).toEqual(['Alice']);
  });
});

describe('isNameList', () => {
  it('rejects the shapes a stale or hand-edited key can produce', () => {
    expect(isNameList(['a', 'b'])).toBe(true);
    expect(isNameList([])).toBe(true);
    expect(isNameList(null)).toBe(false);
    expect(isNameList({ names: [] })).toBe(false);
    expect(isNameList(['a', 3])).toBe(false);
  });
});
