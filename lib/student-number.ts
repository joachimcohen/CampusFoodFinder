/**
 * Format check only: confirms the number looks like a Deakin student ID,
 * not that it belongs to the person typing it. Real proof of enrolment
 * needs Deakin's own sign-in (single sign-on), which is a conversation with
 * Deakin eSolutions.
 *
 * The pattern is configurable so it can be corrected without a code change.
 * Defaults to 9 digits: confirm against a real Deakin student card.
 */
const DEFAULT_PATTERN = "^\\d{9}$";

function pattern(): RegExp {
  const raw = process.env.NEXT_PUBLIC_STUDENT_NUMBER_PATTERN || DEFAULT_PATTERN;
  try {
    return new RegExp(raw);
  } catch {
    return new RegExp(DEFAULT_PATTERN);
  }
}

export function isValidStudentNumber(value: string): boolean {
  return pattern().test(value.trim());
}
