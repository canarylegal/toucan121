"use client";

import { useEffect, useState } from "react";
import { profileQrDownloadName, profileQrPngBlob } from "@/lib/profile-qr";

export function ProfileQrActionButtons({
  url,
  slug,
  shareTitle = "Toucan profile",
  disabled = false,
  className = "",
}: {
  url: string;
  slug: string;
  shareTitle?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setActionError(null);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setActionError("Could not copy link");
    }
  }

  async function downloadPng() {
    try {
      const blob = await profileQrPngBlob(url, 640);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = profileQrDownloadName(slug);
      a.click();
      URL.revokeObjectURL(a.href);
      setActionError(null);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not download QR code",
      );
    }
  }

  async function shareProfile() {
    try {
      const blob = await profileQrPngBlob(url, 640);
      const file = new File([blob], profileQrDownloadName(slug), {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: shareTitle,
          text: url,
          url,
          files: [file],
        });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: shareTitle, url });
      }
      setActionError(null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setActionError(err instanceof Error ? err.message : "Could not share");
    }
  }

  return (
    <div className={`profile-booking-surface ${className}`.trim()}>
      {actionError ? (
        <p className="mb-2 text-center text-xs text-red-700">{actionError}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={downloadPng}
          disabled={disabled}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-accent-soft disabled:opacity-50"
        >
          Download PNG
        </button>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold hover:bg-accent-soft"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={shareProfile}
            disabled={disabled}
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Share
          </button>
        ) : null}
      </div>
    </div>
  );
}
