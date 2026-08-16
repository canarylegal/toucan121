import Link from "next/link";
import { APP_NAME } from "@/lib/brand";

type Props = {
  href?: string;
  /** Hero on marketing home vs compact nav back-link */
  size?: "hero" | "nav";
  className?: string;
};

export function ToucanBrand({
  href = "/",
  size = "nav",
  className = "",
}: Props) {
  const mark = size === "hero" ? 56 : 22;
  const word =
    size === "hero"
      ? "font-serif text-5xl tracking-tight text-accent"
      : "text-sm font-medium";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2.5 hover:opacity-90 ${
        size === "nav" ? "text-muted hover:text-foreground" : ""
      } ${className}`}
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
      <span className={word}>{APP_NAME}</span>
    </Link>
  );
}
