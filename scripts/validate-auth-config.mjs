import { fileURLToPath } from 'node:url';

export const ALLOWED_FEEDBACK_CATEGORIES = Object.freeze([
  'completed','too_difficult','unable_to_perform','uncomfortable','pain','video_not_helpful','missed','general'
]);

export function isValidAccessCode(value) {
  return typeof value === 'string' && /^[A-F0-9]{10}$/.test(value);
}

export function normalizeFeedbackCategory(value) {
  const category = String(value || 'general');
  return ALLOWED_FEEDBACK_CATEGORIES.includes(category) ? category : null;
}

export function parseSymptomRating(value) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return { ok: true, value: null };
  if (typeof value !== 'number' && typeof value !== 'string') return { ok: false, value: null };
  if (typeof value === 'string' && !/^\\d+$/.test(value.trim())) return { ok: false, value: null };
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 0 || rating > 10) return { ok: false, value: null };
  return { ok: true, value: rating };
}

function runSelfTests() {
  const assert = (condition, label) => { if (!condition) throw new Error('Self-test failed: ' + label); };
  assert(isValidAccessCode('A1B2C3D4E5'), 'valid access code');
  for (const value of ['', 'A1B2', 'a1b2c3d4e5', 'G1B2C3D4E5', 'A1B2C3D4E5F', null, 123]) assert(!isValidAccessCode(value), 'reject invalid access code ' + String(value));
  assert(normalizeFeedbackCategory('pain') === 'pain', 'valid feedback category');
  assert(normalizeFeedbackCategory('') === 'general', 'default feedback category');
  assert(normalizeFeedbackCategory('diagnose-me') === null, 'reject unsupported feedback category');
  assert(parseSymptomRating(null).ok && parseSymptomRating(null).value === null, 'optional empty rating');
  assert(parseSymptomRating('0').ok && parseSymptomRating('0').value === 0, 'zero rating');
  assert(parseSymptomRating(10).ok && parseSymptomRating(10).value === 10, 'maximum rating');
  for (const value of [-1, 11, 1.5, 'abc', {}, true]) assert(!parseSymptomRating(value).ok, 'reject invalid rating ' + String(value));
  console.log('Validation self-tests passed: access codes, feedback categories, and symptom ratings.');
}

function validateAuthConfig() {
  const required = ['AUTH_SESSION_SECRET', 'WELLSPRING_DEMO_ACCOUNTS'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    console.error('Missing required authentication environment variables:', missing.join(', '));
    process.exit(1);
  }
  if (process.env.AUTH_SESSION_SECRET.length < 32) {
    console.error('AUTH_SESSION_SECRET must be at least 32 characters.');
    process.exit(1);
  }
  try {
    const accounts = JSON.parse(process.env.WELLSPRING_DEMO_ACCOUNTS);
    if (!Array.isArray(accounts) || accounts.length === 0) throw new Error();
    const roles = new Set(accounts.map(a => a.role));
    if (!roles.has('patient') || !roles.has('clinician')) throw new Error();
    for (const account of accounts) {
      if (!account.id || !account.email || !account.name || !account.salt || !account.passwordHash || !['patient','clinician'].includes(account.role))
        throw new Error();
    }
  } catch {
    console.error('WELLSPRING_DEMO_ACCOUNTS must be a JSON array with id, email, name, role, salt, and passwordHash for each account, including patient and clinician roles.');
    process.exit(1);
  }
  console.log('Authentication configuration shape is valid. This does not test the deployed login or database.');
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectExecution) {
  if (process.argv.includes('--self-test')) runSelfTests();
  else validateAuthConfig();
}
