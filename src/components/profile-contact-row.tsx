import type { ReactNode } from "react";
import type { ContactRowItem } from "@/lib/profile-contact-row";
import {
  MailIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/social-icons";

const ICONS: Record<
  ContactRowItem["id"],
  (props: { className?: string }) => ReactNode
> = {
  phone: PhoneIcon,
  publicEmail: MailIcon,
  whatsappUrl: WhatsAppIcon,
};

export function ProfileContactRow({ items }: { items: ContactRowItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-3"
      aria-label="Contact"
    >
      {items.map((item) => {
        const Icon = ICONS[item.id];
        return (
          <a
            key={item.id}
            href={item.href}
            target={item.external ? "_blank" : undefined}
            rel={item.external ? "noreferrer" : undefined}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--profile-line)] bg-[var(--profile-panel)] text-[var(--profile-accent)] shadow-sm transition hover:border-[var(--profile-accent)] hover:bg-[var(--profile-accent-soft)]"
            title={item.label}
            aria-label={item.label}
          >
            <Icon className="h-5 w-5 shrink-0" />
          </a>
        );
      })}
    </nav>
  );
}
