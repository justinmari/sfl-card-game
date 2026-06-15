import { describe, it, expect } from 'vitest'
import {
  parsePreferences,
  serializePreferences,
  DEFAULT_PREFERENCES,
  type Preferences,
} from '@/lib/preferences'

describe('parsePreferences', () => {
  it('returns defaults for null', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults for empty string', () => {
    expect(parsePreferences('')).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults for malformed JSON', () => {
    expect(parsePreferences('not json {')).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults when JSON is the literal null', () => {
    expect(parsePreferences('null')).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults when JSON is not an object', () => {
    expect(parsePreferences('42')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('"hello"')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('[1,2,3]')).toEqual({ compactCards: false })
  })

  it('returns defaults for an empty object', () => {
    expect(parsePreferences('{}')).toEqual(DEFAULT_PREFERENCES)
  })

  it('reads a valid compactCards value', () => {
    expect(parsePreferences('{"compactCards":true}')).toEqual({ compactCards: true })
    expect(parsePreferences('{"compactCards":false}')).toEqual({ compactCards: false })
  })

  it('falls back to default when compactCards is the wrong type', () => {
    expect(parsePreferences('{"compactCards":"yes"}')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('{"compactCards":1}')).toEqual(DEFAULT_PREFERENCES)
    expect(parsePreferences('{"compactCards":null}')).toEqual(DEFAULT_PREFERENCES)
  })

  it('ignores unknown keys', () => {
    expect(parsePreferences('{"compactCards":true,"theme":"dark"}')).toEqual({ compactCards: true })
  })

  it('does not mutate DEFAULT_PREFERENCES', () => {
    const result = parsePreferences(null)
    result.compactCards = true
    expect(DEFAULT_PREFERENCES.compactCards).toBe(false)
  })
})

describe('serializePreferences', () => {
  it('round-trips through parse', () => {
    const prefs: Preferences = { compactCards: true }
    expect(parsePreferences(serializePreferences(prefs))).toEqual(prefs)
  })

  it('produces valid JSON', () => {
    expect(JSON.parse(serializePreferences({ compactCards: false }))).toEqual({ compactCards: false })
  })
})
