import test from 'node:test';
import assert from 'node:assert/strict';
import { localSummary, matchVideos } from '../api/report-logic.mjs';

test('fallback labels itself as non-AI and does not prescribe', () => {
  const summary = localSummary('Synthetic report: urinary leakage with pain reported.');
  assert.match(summary.summary, /Local fallback only/);
  assert.match(summary.caution, /No diagnosis, prescription, or exercise clearance/);
  assert.ok(summary.mentioned.includes('Pain mentioned'));
});

test('report video matching is topic-driven and has no unrelated default', () => {
  assert.equal(matchVideos('Synthetic report with unrelated topic only').length, 0);
  const picks = matchVideos('Synthetic urinary leakage case');
  assert.ok(picks.some(v => v.title.includes('NHS')));
});

test('keyword summary only flags a small explicit list of terms', () => {
  const summary = localSummary('Synthetic report mentions diabetes and a past operation.');
  assert.ok(summary.mentioned.includes('Diabetes/glucose mentioned'));
  assert.ok(summary.mentioned.includes('Surgery/post-operative wording'));
});
