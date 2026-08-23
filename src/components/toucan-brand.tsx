import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

type Props = {
  href?: string;
  /** Hero on marketing home vs compact nav back-link */
  size?: "hero" | "nav";
  /** Muted treatment on themed public profiles */
  tone?: "default" | "profile";
  className?: string;
};

export function ToucanBrand({
  href = "/",
  size = "nav",
  tone = "default",
  className = "",
}: Props) {
  const mark = size === "hero" ? 56 : tone === "profile" ? 18 : 22;
  const word =
    size === "hero"
      ? "font-serif text-5xl tracking-tight text-accent"
      : tone === "profile"
        ? "text-xs font-medium tracking-normal"
        : "text-sm font-medium";

  const profileTone = tone === "profile";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 hover:opacity-90 ${
        profileTone
          ? "gap-1.5 opacity-75 hover:opacity-100"
          : size === "nav"
            ? "text-muted hover:text-foreground"
            : ""
      } ${className}`}
      style={profileTone ? { color: "var(--profile-muted)" } : undefined}
    >
      {/* Plain img: Next/Image optimizer was flattening the mark onto a white square */}
      <img
        src="/toucan-mark-v2.png"
        alt=""
        width={mark}
        height={mark}
        className="shrink-0"
        decoding="async"
      />
      <span className={word}>
        {profileTone ? "Toucan" : APP_NAME}
      </span>
    </Link>
  );
}
