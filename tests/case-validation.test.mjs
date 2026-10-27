import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidAccessCode, normalizeFeedbackCategory, parseSymptomRating } from '../api/case-validation.mjs';

test('accepts only ten-character uppercase hexadecimal access codes', () => {
  assert.equal(isValidAccessCode('A1B2C3D4E5'), true);
  for (const value of ['', 'A1B2', 'a1b2c3d4e5', 'G1B2C3D4E5', 'A1B2C3D4E5F', null, 123]) {
    assert.equal(isValidAccessCode(value), false, String(value));
  }
});

test('normalizes only supported feedback categories', () => {
  assert.equal(normalizeFeedbackCategory('pain'), 'pain');
  assert.equal(normalizeFeedbackCategory('completed'), 'completed');
  assert.equal(normalizeFeedbackCategory(''), 'general');
  assert.equal(normalizeFeedbackCategory('diagnose-me'), null);
});

test('accepts optional integer symptom ratings from zero to ten', () => {
  assert.deepEqual(parseSymptomRating(null), { ok: true, value: null });
  assert.deepEqual(parseSymptomRating(''), { ok: true, value: null });
  assert.deepEqual(parseSymptomRating('0'), { ok: true, value: 0 });
  assert.deepEqual(parseSymptomRating(10), { ok: true, value: 10 });
  for (const value of [-1, 11, 1.5, 'abc', {}, true]) {
    assert.equal(parseSymptomRating(value).ok, false, String(value));
  }
});
