/**
 * Format check only, run on the student's phone: confirms the number looks
 * like a Deakin student ID. We trust students to be honest, so this is a
 * gentle "students only" check, not proof of enrolment (that would need
 * Deakin's own sign-in). The number is never sent to the server.
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
