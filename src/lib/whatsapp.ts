/** Normalise phone or URL input to a WhatsApp chat link. */
export function normalizeWhatsAppUrl(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase();
      if (host === "wa.me" || host.endsWith(".whatsapp.com")) {
        return url.toString();
      }
    } catch {
      return "";
    }
    return "";
  }

  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return "";

  const withoutPlus = digits.startsWith("+") ? digits.slice(1) : digits;
  if (!/^\d{6,15}$/.test(withoutPlus)) return "";

  return `https://wa.me/${withoutPlus}`;
}

export function isValidWhatsAppInput(input: string): boolean {
  if (!input.trim()) return true;
  return normalizeWhatsAppUrl(input) !== "";
}
