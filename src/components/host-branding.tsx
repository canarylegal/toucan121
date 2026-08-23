import type { ReactNode } from "react";
import { SOCIAL_LINK_META, type SocialLinkKey } from "@/components/social-icons";
import { parseSocialOrder } from "@/lib/social-order";
import { formatTimezoneDisplay } from "@/lib/timezones";

export type PublicHostBranding = {
  name: string;
  headline?: string;
  businessName: string;
  bio: string;
  websiteUrl: string;
  publicEmail?: string;
  phone?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  xUrl?: string;
  youtubeUrl?: string;
  socialOrder?: SocialLinkKey[] | string;
  avatarPath: string | null;
  timezone?: string;
};

function linkValue(host: PublicHostBranding, key: SocialLinkKey): string {
  return (host[key] ?? "").trim();
}

export function HostBrandingHeader({
  host,
  showTimezone = true,
  variant = "default",
  hideSocialIcons = false,
  themed = false,
  avatarSlot,
}: {
  host: PublicHostBranding;
  showTimezone?: boolean;
  variant?: "default" | "centered";
  hideSocialIcons?: boolean;
  themed?: boolean;
  avatarSlot?: ReactNode;
}) {
  const order = parseSocialOrder(
    Array.isArray(host.socialOrder)
      ? JSON.stringify(host.socialOrder)
      : host.socialOrder,
  );
  const metaByKey = new Map(SOCIAL_LINK_META.map((m) => [m.key, m]));
  const links = order
    .map((key) => metaByKey.get(key))
    .filter((m): m is (typeof SOCIAL_LINK_META)[number] => Boolean(m))
    .filter((m) => linkValue(host, m.key));

  const avatar = avatarSlot ?? (host.avatarPath ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={host.avatarPath}
      alt=""
      className="h-36 w-36 shrink-0 rounded-full object-cover ring-1 ring-line sm:h-40 sm:w-40"
    />
  ) : (
    <div
      aria-hidden
      className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-accent-soft text-4xl font-semibold text-accent ring-1 ring-line sm:h-40 sm:w-40 sm:text-5xl"
    >
      {host.name.slice(0, 1).toUpperCase()}
    </div>
  ));

  const mutedClass = themed ? "" : "text-muted";
  const fgClass = themed ? "" : "text-foreground/85";
  const mutedStyle = themed ? { color: "var(--profile-muted)" } : undefined;
  const fgStyle = themed ? { color: "var(--profile-fg)" } : undefined;

  const meta = (
    <div
      className={
        variant === "centered" ? "w-full min-w-0 text-center" : "min-w-0"
      }
    >
      <h1
        className={
          variant === "centered"
            ? "font-serif text-3xl tracking-tight"
            : "font-serif text-4xl tracking-tight"
        }
        style={themed ? { color: "var(--profile-fg)" } : undefined}
      >
        {host.name}
      </h1>
      {host.headline ? (
        <p className={`mt-1 text-lg ${fgClass}`} style={fgStyle}>
          {host.headline}
        </p>
      ) : null}
      {host.businessName ? (
        <p className={`mt-1 text-base ${mutedClass}`} style={mutedStyle}>
          {host.businessName}
        </p>
      ) : null}
      {host.bio ? (
        <p
          className={`mt-3 text-[15px] leading-relaxed ${fgClass} ${
            variant === "centered"
              ? "mx-auto max-w-sm whitespace-pre-line text-center"
              : "max-w-prose whitespace-pre-wrap"
          }`}
          style={fgStyle}
        >
          {host.bio}
        </p>
      ) : null}
      <div
        className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm ${mutedClass} ${
          variant === "centered" ? "justify-center" : ""
        }`}
        style={mutedStyle}
      >
        {showTimezone && host.timezone ? (
          <span>{formatTimezoneDisplay(host.timezone)}</span>
        ) : null}
        {!hideSocialIcons && links.length > 0 ? (
          <ul className="flex flex-wrap items-center gap-2">
            {links.map(({ key, label, Icon, href }) => {
              const value = linkValue(host, key);
              return (
                <li key={key}>
                  <a
                    href={href(value)}
                    target={
                      key === "publicEmail" || key === "phone"
                        ? undefined
                        : "_blank"
                    }
                    rel={
                      key === "publicEmail" || key === "phone"
                        ? undefined
                        : "noreferrer"
                    }
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-foreground/80 transition hover:bg-accent-soft hover:text-accent"
                    title={label}
                    aria-label={label}
                  >
                    <Icon />
                    <span className="sr-only">{label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );

  if (variant === "centered") {
    return (
      <header className="flex flex-col items-center gap-4 text-center">
        {avatar}
        {meta}
      </header>
    );
  }

  return (
    <header className="flex gap-5">
      {avatar}
      {meta}
    </header>
  );
}
