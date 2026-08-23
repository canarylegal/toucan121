import { CopyLinkButton } from "@/components/copy-link-button";
import { ProfileQrButton } from "@/components/profile-qr-modal";

export function ProfileLinkActions({
  url,
  slug,
}: {
  url: string;
  slug: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <CopyLinkButton value={url} />
      <ProfileQrButton url={url} slug={slug} />
    </div>
  );
}
