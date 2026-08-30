import type { SocialLinkKey } from "@/components/social-icons";

export const CONTACT_ROW_SOCIAL_KEYS: SocialLinkKey[] = [
  "publicEmail",
  "phone",
];

export type ContactRowHostFields = {
  phone: string;
  publicEmail: string;
  whatsappUrl: string;
  contactRowEnabled: boolean;
};

export type ContactRowItem = {
  id: "phone" | "publicEmail" | "whatsappUrl";
  label: string;
  href: string;
  external: boolean;
};

export function countContactRowFields(host: ContactRowHostFields): number {
  let n = 0;
  if (host.phone.trim()) n += 1;
  if (host.publicEmail.trim()) n += 1;
  if (host.whatsappUrl.trim()) n += 1;
  return n;
}

export function shouldShowContactRow(host: ContactRowHostFields): boolean {
  return (
    host.contactRowEnabled &&
    countContactRowFields(host) >= 2
  );
}

export function resolveContactRowItems(
  host: ContactRowHostFields,
): ContactRowItem[] {
  const items: ContactRowItem[] = [];

  if (host.phone.trim()) {
    items.push({
      id: "phone",
      label: "Phone",
      href: `tel:${host.phone.replace(/[^\d+]/g, "")}`,
      external: false,
    });
  }

  if (host.publicEmail.trim()) {
    items.push({
      id: "publicEmail",
      label: "Email",
      href: `mailto:${host.publicEmail.trim()}`,
      external: false,
    });
  }

  if (host.whatsappUrl.trim()) {
    items.push({
      id: "whatsappUrl",
      label: "WhatsApp",
      href: host.whatsappUrl.trim(),
      external: true,
    });
  }

  return items;
}
