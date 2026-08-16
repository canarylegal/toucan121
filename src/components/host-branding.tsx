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
}: {
  host: PublicHostBranding;
  showTimezone?: boolean;
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

  return (
    <header className="flex gap-5">
      {host.avatarPath ? (
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
      )}
      <div className="min-w-0">
        <h1 className="font-serif text-4xl tracking-tight">{host.name}</h1>
        {host.headline ? (
          <p className="mt-1 text-lg text-foreground/85">{host.headline}</p>
        ) : null}
        {host.businessName ? (
          <p className="mt-1 text-base text-muted">{host.businessName}</p>
        ) : null}
        {host.bio ? (
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-foreground/85">
            {host.bio}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
          {showTimezone && host.timezone ? (
            <span>{formatTimezoneDisplay(host.timezone)}</span>
          ) : null}
          {links.length > 0 ? (
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
    </header>
  );
}
