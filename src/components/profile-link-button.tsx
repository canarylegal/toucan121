import type { ResolvedStackButton } from "@/lib/profile-stack";
import {
  stackButtonTextColor,
  type ResolvedProfileTheme,
} from "@/lib/profile-theme";
import { CalendarIcon, SOCIAL_LINK_META } from "@/components/social-icons";
import { HostLinkIcon } from "@/components/link-icons";
import { parseHostLinkIconKey } from "@/lib/link-icons";

const defaultButtonClass =
  "profile-stack-button block w-full rounded-lg border border-line bg-panel px-4 py-3.5 text-center text-sm font-semibold text-foreground transition hover:border-accent/60 hover:bg-accent-soft";

function ButtonLabel({
  item,
  theme,
}: {
  item: ResolvedStackButton;
  theme?: ResolvedProfileTheme;
}) {
  const showIcons = theme?.showSocialIconsOnButtons;

  if (item.kind === "book" && showIcons) {
    return (
      <span className="inline-flex items-center justify-center gap-2">
        <CalendarIcon className="shrink-0" />
        <span>{item.label}</span>
      </span>
    );
  }

  if (item.kind === "link" && showIcons) {
    const emoji = (item.linkEmoji ?? "").trim();
    if (emoji) {
      return (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="text-base leading-none" aria-hidden>{emoji}</span>
          <span>{item.label}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center gap-2">
        <HostLinkIcon
          keyName={parseHostLinkIconKey(item.linkIconKey)}
          className="shrink-0"
        />
        <span>{item.label}</span>
      </span>
    );
  }

  const showSocialIcon =
    showIcons && item.socialKey && item.kind === "social";
  const meta = showSocialIcon
    ? SOCIAL_LINK_META.find((m) => m.key === item.socialKey)
    : null;
  const Icon = meta?.Icon;

  return (
    <span className="inline-flex items-center justify-center gap-2">
      {Icon ? <Icon className="shrink-0" /> : null}
      <span>{item.label}</span>
    </span>
  );
}

export function ProfileLinkButton({
  item,
  onBook,
  theme,
}: {
  item: ResolvedStackButton;
  onBook?: () => void;
  theme?: ResolvedProfileTheme;
}) {
  const buttonClass = theme?.buttonClass ?? defaultButtonClass;
  const buttonStyle = theme
    ? { color: stackButtonTextColor(theme) }
    : undefined;

  if (item.kind === "book") {
    return (
      <button
        type="button"
        onClick={onBook}
        className={buttonClass}
        style={buttonStyle}
      >
        <ButtonLabel item={item} theme={theme} />
      </button>
    );
  }

  if (!item.href) return null;

  return (
    <a
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noreferrer" : undefined}
      className={buttonClass}
      style={buttonStyle}
    >
      <ButtonLabel item={item} theme={theme} />
    </a>
  );
}

export function ProfileLinkButtonList({
  items,
  onBook,
  theme,
}: {
  items: ResolvedStackButton[];
  onBook?: () => void;
  theme?: ResolvedProfileTheme;
}) {
  if (items.length === 0) return null;

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id}>
          <ProfileLinkButton item={item} onBook={onBook} theme={theme} />
        </li>
      ))}
    </ul>
  );
}
