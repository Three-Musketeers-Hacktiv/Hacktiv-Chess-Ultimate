/** Minimal className joiner — drops falsy values. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ')
}
