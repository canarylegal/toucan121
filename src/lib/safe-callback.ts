/** Same-origin relative path only — blocks open redirects after login. */
export function safeCallbackPath(raw: unknown): string {
  if (typeof raw !== "string") return "/dash";
  let value = raw.trim();
  if (!value) return "/dash";

  try {
    value = decodeURIComponent(value);
  } catch {
    return "/dash";
  }
  value = value.trim();

  if (!value.startsWith("/")) return "/dash";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/dash";
  if (value.includes("://") || value.includes("\\")) return "/dash";
  if (/[\0-\x1f\x7f]/.test(value)) return "/dash";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value.slice(1))) return "/dash";

  return value;
}
