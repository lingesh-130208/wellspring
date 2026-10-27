export const ALLOWED_FEEDBACK_CATEGORIES: readonly string[];
export function isValidAccessCode(value: unknown): value is string;
export function normalizeFeedbackCategory(value: unknown): string | null;
export function parseSymptomRating(value: unknown): { ok: boolean; value: number | null };
