"use client";

import { useEffect, useState } from "react";
import { renderProfileQrCanvas } from "@/lib/profile-qr";
import { ProfileQrActionButtons } from "@/components/profile-qr-action-buttons";

function QrIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className={className}
      aria-hidden
    >
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
      <path d="M14 14h2v2h-2zM18 14h2v6h-2zM14 18h2v2h-2z" />
    </svg>
  );
}

export function ProfileQrButton({
  url,
  slug,
}: {
  url: string;
  slug: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
        aria-label="Show profile QR code"
      >
        <QrIcon className="h-4 w-4" />
        QR
      </button>
      {open ? (
        <ProfileQrModal
          url={url}
          slug={slug}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ProfileQrModal({
  url,
  slug,
  onClose,
}: {
  url: string;
  slug: string;
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDataUrl(null);

    renderProfileQrCanvas(url, 320)
      .then((canvas) => {
        if (cancelled) return;
        setDataUrl(canvas.toDataURL("image/png"));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not generate QR code",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-qr-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="profile-booking-surface relative z-10 w-full max-w-sm rounded-lg border border-line bg-panel p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="profile-qr-title" className="text-lg font-semibold">
              Profile link QR
            </h2>
            <p className="mt-1 text-xs text-muted">
              Scan to open your public profile page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-accent-soft hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex min-h-[320px] items-center justify-center">
          {loading ? (
            <p className="text-sm text-muted">Generating…</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={dataUrl}
              alt="Profile QR code"
              width={320}
              height={320}
              className="rounded-md border border-line bg-white"
            />
          ) : null}
        </div>

        <p className="mt-4 break-all text-center text-xs text-muted">{url}</p>

        <ProfileQrActionButtons
          url={url}
          slug={slug}
          shareTitle="My Toucan profile"
          disabled={loading || Boolean(error) || !dataUrl}
          className="mt-5"
        />
      </div>
    </div>
  );
}
