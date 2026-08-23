"use client";

import { useCallback, useEffect, useState } from "react";
import { renderProfileQrCanvas } from "@/lib/profile-qr";
import { ProfileQrActionButtons } from "@/components/profile-qr-action-buttons";

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function ProfileTreeAvatarGallery({
  avatarPath,
  name,
  profileUrl,
  hostSlug,
}: {
  avatarPath: string | null;
  name: string;
  profileUrl: string;
  hostSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const hasAvatar = Boolean(avatarPath);
  const slideCount = hasAvatar ? 2 : 1;
  const onQrSlide = hasAvatar ? index === 1 : true;

  const close = useCallback(() => {
    setOpen(false);
    setIndex(0);
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + slideCount) % slideCount);
  }, [slideCount]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % slideCount);
  }, [slideCount]);

  useEffect(() => {
    if (!open || !onQrSlide) return;

    let cancelled = false;
    setQrLoading(true);
    setQrError(null);

    renderProfileQrCanvas(profileUrl, 400)
      .then((canvas) => {
        if (cancelled) return;
        setQrDataUrl(canvas.toDataURL("image/png"));
      })
      .catch((err) => {
        if (cancelled) return;
        setQrError(
          err instanceof Error ? err.message : "Could not generate QR code",
        );
      })
      .finally(() => {
        if (!cancelled) setQrLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, onQrSlide, profileUrl]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, goPrev, goNext]);

  const avatarDisplay = avatarPath ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarPath}
      alt=""
      className="h-36 w-36 shrink-0 rounded-full object-cover ring-1 ring-line sm:h-40 sm:w-40"
    />
  ) : (
    <div
      aria-hidden
      className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full bg-accent-soft text-4xl font-semibold text-accent ring-1 ring-line sm:h-40 sm:w-40 sm:text-5xl"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );

  const tapHint = hasAvatar ? "Tap for photo & QR" : "Tap for profile QR";

  return (
    <>
      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full transition hover:ring-2 hover:ring-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={
            hasAvatar
              ? "View profile photo and QR code"
              : "View profile QR code"
          }
        >
          {avatarDisplay}
        </button>
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--profile-muted)" }}
        >
          {tapHint}
        </p>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo and QR code"
        >
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close"
            onClick={close}
          />
          <div className="profile-booking-surface relative z-10 w-full max-w-md rounded-lg border border-line bg-panel p-6 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              {slideCount > 1 ? (
                <div className="flex gap-3 text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setIndex(0)}
                    className={
                      !onQrSlide
                        ? "text-foreground underline"
                        : "text-muted hover:text-foreground"
                    }
                  >
                    Photo
                  </button>
                  <span className="text-muted/40">·</span>
                  <button
                    type="button"
                    onClick={() => setIndex(1)}
                    className={
                      onQrSlide
                        ? "text-foreground underline"
                        : "text-muted hover:text-foreground"
                    }
                  >
                    QR code
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted">Profile QR code</p>
              )}
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-sm text-muted hover:bg-accent-soft hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="relative mt-5 flex min-h-[min(400px,70vh)] items-center justify-center">
              {slideCount > 1 ? (
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-0 z-10 rounded-full border border-line bg-panel p-2 text-foreground shadow-sm hover:bg-accent-soft"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : null}

              <div className="flex max-h-[min(400px,70vh)] max-w-full items-center justify-center px-10">
                {onQrSlide ? (
                  qrLoading ? (
                    <p className="text-sm text-muted">Generating QR…</p>
                  ) : qrError ? (
                    <p className="text-sm text-red-700">{qrError}</p>
                  ) : qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrDataUrl}
                      alt="Profile QR code"
                      className="max-h-[min(400px,70vh)] w-auto rounded-md border border-line bg-white"
                    />
                  ) : null
                ) : avatarPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPath}
                    alt={name}
                    className="max-h-[min(400px,70vh)] max-w-full rounded-full object-contain"
                  />
                ) : null}
              </div>

              {slideCount > 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-0 z-10 rounded-full border border-line bg-panel p-2 text-foreground shadow-sm hover:bg-accent-soft"
                  aria-label="Next"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              ) : null}
            </div>

            {onQrSlide ? (
              <>
                <p className="mt-4 break-all text-center text-xs text-muted">
                  {profileUrl}
                </p>
                <ProfileQrActionButtons
                  url={profileUrl}
                  slug={hostSlug}
                  shareTitle={`${name} on Toucan`}
                  disabled={qrLoading || Boolean(qrError) || !qrDataUrl}
                  className="mt-4"
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
