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
  if (value === null || value === undefined || value === '') return { ok: true, value: null };
  const rating = Number(value);
  if (!Number.isInteger(rating) || rating < 0 || rating > 10) return { ok: false, value: null };
  return { ok: true, value: rating };
}
