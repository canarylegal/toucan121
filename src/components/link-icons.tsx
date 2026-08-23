import type { SVGProps } from "react";
import type { HostLinkIconKey } from "@/lib/link-icons";
import { CalendarIcon } from "@/components/social-icons";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      width="1.15em"
      height="1.15em"
      {...props}
    />
  );
}

function LinkChainIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3.9 12a5 5 0 0 1 1.46-3.54l2.12-2.12a5 5 0 0 1 7.07 0l1.41 1.41-1.41 1.42-1.41-1.42a3 3 0 0 0-4.24 0L5.54 9.88a3 3 0 0 0 0 4.24l1.41 1.41-1.41 1.42L3.9 12zm7.07-7.07a5 5 0 0 1 7.07 0l2.12 2.12a5 5 0 0 1 0 7.07l-1.41 1.41-1.42-1.41 1.41-1.42a3 3 0 0 0 0-4.24l-2.12-2.12a3 3 0 0 0-4.24 0l-1.41 1.41-1.42-1.41 1.41-1.41z" />
    </IconBase>
  );
}

function ShopIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4V2h10v2h5v2l-1.5 12.5A2 2 0 0 1 19.5 17h-11a2 2 0 0 1-1.99-1.73L4 6V4h3zm2 0h6V4H9v2zm-2.2 2L6.2 16.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.45L18.2 6H6.8z" />
    </IconBase>
  );
}

function BlogIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 2h9l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm8 1.5V8h5.5L14 3.5zM8 11h8v2H8v-2zm0 4h8v2H8v-2zm0 4h5v2H8v-2z" />
    </IconBase>
  );
}

function VideoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6zm2 0v12h12V6H6zm3 3.5 6 3.5-6 3.5v-7z" />
    </IconBase>
  );
}

function PodcastIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 14a3 3 0 0 0-3 3v4h6v-4a3 3 0 0 0-3-3zm5-3a5 5 0 0 1-1.17 3.17l1.42 1.42A7 7 0 0 0 19 11h-2zm-10 0a7 7 0 0 0 2.59 5.59l1.42-1.42A5 5 0 0 1 7 11H5a7 7 0 0 0 2.59 5.59zM12 4a4 4 0 0 0-4 4H6a6 6 0 0 1 12 0h-2a4 4 0 0 0-4-4zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
    </IconBase>
  );
}

function MusicIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
    </IconBase>
  );
}

function FileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 2h8l6 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V9h5.5L13 3.5z" />
    </IconBase>
  );
}

function DownloadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 3h2v9.17l2.59-2.58L21 12l-5 5-5-5 1.41-1.41L11 12.17V3zm-7 16h16v2H4v-2z" />
    </IconBase>
  );
}

function MapIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5z" />
    </IconBase>
  );
}

function GiftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 7h-2.18C18.4 5.84 17.3 5 16 5c-1.1 0-2 .6-2.6 1.5C12.9 5.6 12 5 11 5 9.7 5 8.6 5.84 8.18 7H6a2 2 0 0 0-2 2v1h20V9a2 2 0 0 0-2-2zM4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7H4zm6 2h8v5H10v-5zM9 7c0-.55.45-1 1-1s1 .45 1 1v1H9V7zm5 0v1h2V7c0-.55-.45-1-1-1s-1 .45-1 1z" />
    </IconBase>
  );
}

function TicketIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 10V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v4a2 2 0 0 1 0 4v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 1 0-4zm-2 8H4v-2.18A3.99 3.99 0 0 0 6 12a3.99 3.99 0 0 0-2-1.82V8h16v2.18A3.99 3.99 0 0 0 18 12c0 .7.18 1.36.5 1.94V18z" />
    </IconBase>
  );
}

function NewsletterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5L4 8V6l8 5 8-5v2z" />
    </IconBase>
  );
}

function ContactIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z" />
    </IconBase>
  );
}

const ICON_BY_KEY: Record<
  HostLinkIconKey,
  (props: IconProps) => React.ReactElement
> = {
  link: LinkChainIcon,
  shop: ShopIcon,
  blog: BlogIcon,
  video: VideoIcon,
  podcast: PodcastIcon,
  music: MusicIcon,
  file: FileIcon,
  download: DownloadIcon,
  calendar: CalendarIcon,
  map: MapIcon,
  gift: GiftIcon,
  ticket: TicketIcon,
  newsletter: NewsletterIcon,
  contact: ContactIcon,
};

export function HostLinkIcon({
  keyName,
  ...props
}: IconProps & { keyName: HostLinkIconKey }) {
  const Icon = ICON_BY_KEY[keyName] ?? LinkChainIcon;
  return <Icon {...props} />;
}
