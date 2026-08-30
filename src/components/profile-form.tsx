"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfileAction,
  type ProfileFormState,
} from "@/lib/profile-actions";
import {
  formatTimezoneOptionLabel,
  listTimezones,
} from "@/lib/timezones";
import type { ProfileFormValues } from "@/lib/profile";
import {
  SOCIAL_LINK_META,
  type SocialLinkKey,
} from "@/components/social-icons";
import { parseSocialOrder } from "@/lib/social-order";
import {
  mergeProfileStackOrder,
  parseProfileStackOrder,
  stringifyProfileStackOrder,
  type ProfileStackEntry,
} from "@/lib/profile-stack";
import { CONTACT_ROW_SOCIAL_KEYS } from "@/lib/profile-contact-row";
import {
  resolveProfileTheme,
  stringifyProfileTheme,
} from "@/lib/profile-theme";
import {
  ProfileLinksManager,
  ProfileStackEditor,
} from "@/components/profile-stack-editor";
import {
  ProfileThemeEditor,
  profileThemeFromInitial,
} from "@/components/profile-theme-editor";

export type { ProfileFormValues };

type Props = {
  initial: ProfileFormValues;
  variant?: "page" | "inline";
  onSaved?: () => void;
};

const TIMEZONES = listTimezones();
const TIMEZONE_LABELS = Object.fromEntries(
  TIMEZONES.map((tz) => [tz, formatTimezoneOptionLabel(tz)]),
);

const SOCIAL_MEDIA_KEYS: SocialLinkKey[] = [
  "linkedinUrl",
  "facebookUrl",
  "instagramUrl",
  "tiktokUrl",
  "xUrl",
  "youtubeUrl",
];

function stackLinks(links: ProfileFormValues["links"]) {
  return (links ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    active: true as const,
    iconKey: l.iconKey ?? "link",
    emoji: l.emoji ?? "",
  }));
}

function editorLinks(links: ProfileFormValues["links"]) {
  return (links ?? []).map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    iconKey: l.iconKey ?? "link",
    emoji: l.emoji ?? "",
  }));
}

export function ProfileForm({ initial, variant = "page", onSaved }: Props) {
  const router = useRouter();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [state, action, pending] = useActionState(
    updateProfileAction,
    { values: initial } satisfies ProfileFormState,
  );
  const values = { ...initial, ...(state.values ?? {}) };
  const [managedLinks, setManagedLinks] = useState(initial.links ?? []);
  const links = managedLinks;
  const [layoutMode, setLayoutMode] = useState<"BOOK_FIRST" | "LINKS_FIRST">(
    initial.profileLayoutMode ?? "BOOK_FIRST",
  );
  const linksFirst = layoutMode === "LINKS_FIRST";
  const [profileTheme, setProfileTheme] = useState(() =>
    profileThemeFromInitial(initial.profileThemeJson),
  );
  const [socialOrder, setSocialOrder] = useState<SocialLinkKey[]>(() =>
    parseSocialOrder(JSON.stringify(initial.socialOrder ?? [])),
  );
  const [contactFields, setContactFields] = useState({
    phone: initial.phone ?? "",
    publicEmail: initial.publicEmail ?? "",
    whatsappUrl: initial.whatsappUrl ?? "",
  });
  const [contactRowEnabled, setContactRowEnabled] = useState(
    initial.contactRowEnabled ?? true,
  );
  const [profileStackOrder, setProfileStackOrder] = useState<ProfileStackEntry[]>(
    () => {
      const hostFields = stackHostFields(initial);
      return mergeProfileStackOrder({
        saved: parseProfileStackOrder(initial.profileStackOrderJson),
        host: hostFields,
        links: stackLinks(links),
        includeBook:
          initial.profileLayoutMode === "LINKS_FIRST" &&
          (initial.bookingEnabled ?? true) &&
          (initial.hasBookableMeetingTypes ?? false),
      });
    },
  );

  const contactFieldCount = [
    contactFields.phone,
    contactFields.publicEmail,
    contactFields.whatsappUrl,
  ].filter((v) => v.trim()).length;
  const contactRowWouldShow =
    linksFirst && contactRowEnabled && contactFieldCount >= 2;

  useEffect(() => {
    setManagedLinks(initial.links ?? []);
  }, [initial.links, state.formKey]);

  const linkKey = links
    .map(
      (l) =>
        `${l.id}:${l.title}:${l.url}:${l.iconKey ?? "link"}:${l.emoji ?? ""}`,
    )
    .join("|");

  const socialValues = useMemo(
    () => ({
      websiteUrl: values.websiteUrl,
      publicEmail: values.publicEmail,
      phone: values.phone,
      linkedinUrl: values.linkedinUrl,
      facebookUrl: values.facebookUrl,
      instagramUrl: values.instagramUrl,
      tiktokUrl: values.tiktokUrl,
      xUrl: values.xUrl,
      youtubeUrl: values.youtubeUrl,
    }),
    [
      values.websiteUrl,
      values.publicEmail,
      values.phone,
      values.linkedinUrl,
      values.facebookUrl,
      values.instagramUrl,
      values.tiktokUrl,
      values.xUrl,
      values.youtubeUrl,
    ],
  );

  useEffect(() => {
    const hostFields = stackHostFields({
      ...initial,
      socialOrder,
      phone: contactFields.phone,
      publicEmail: contactFields.publicEmail,
      whatsappUrl: contactFields.whatsappUrl,
      contactRowEnabled,
    });
    setProfileStackOrder((prev) =>
      mergeProfileStackOrder({
        saved: prev,
        host: hostFields,
        links: stackLinks(links),
        includeBook:
          layoutMode === "LINKS_FIRST" &&
          (initial.bookingEnabled ?? true) &&
          (initial.hasBookableMeetingTypes ?? false),
        excludeContactRowSocials: contactRowWouldShow,
      }),
    );
  }, [
    linkKey,
    layoutMode,
    socialOrder,
    initial,
    links,
    contactFields,
    contactRowWouldShow,
    contactRowEnabled,
  ]);

  useEffect(() => {
    setContactFields({
      phone: values.phone ?? "",
      publicEmail: values.publicEmail ?? "",
      whatsappUrl: values.whatsappUrl ?? "",
    });
    setContactRowEnabled(values.contactRowEnabled ?? true);
  }, [
    state.formKey,
    values.phone,
    values.publicEmail,
    values.whatsappUrl,
    values.contactRowEnabled,
  ]);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onSaved?.();
    }
  }, [state.success, router, onSaved]);

  useEffect(() => {
    if (state.values?.socialOrder) {
      setSocialOrder(parseSocialOrder(JSON.stringify(state.values.socialOrder)));
    }
  }, [state.formKey, state.values?.socialOrder]);

  useEffect(() => {
    if (state.values?.profileThemeJson) {
      setProfileTheme(profileThemeFromInitial(state.values.profileThemeJson));
    }
  }, [state.formKey, state.values?.profileThemeJson]);

  const socialMediaOrder = useMemo(
    () => socialOrder.filter((k) => SOCIAL_MEDIA_KEYS.includes(k)),
    [socialOrder],
  );

  function moveSocial(key: SocialLinkKey, dir: -1 | 1) {
    setSocialOrder((prev) => {
      const media = prev.filter((k) => SOCIAL_MEDIA_KEYS.includes(k));
      const rest = prev.filter((k) => !SOCIAL_MEDIA_KEYS.includes(k));
      const idx = media.indexOf(key);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= media.length) return prev;
      const swapped = [...media];
      const tmp = swapped[idx]!;
      swapped[idx] = swapped[next]!;
      swapped[next] = tmp;
      return parseSocialOrder(JSON.stringify([...swapped, ...rest]));
    });
  }

  return (
    <form key={state.formKey ?? 0} action={action} className="space-y-4">
      <input
        type="hidden"
        name="socialOrderJson"
        value={JSON.stringify(socialOrder)}
      />
      <input
        type="hidden"
        name="profileStackOrderJson"
        value={stringifyProfileStackOrder(profileStackOrder)}
      />
      <AvatarField
        savedPath={values.avatarPath ?? initial.avatarPath}
        displayName={values.name || initial.name}
        onUploaded={() => router.refresh()}
        onUploadStateChange={setAvatarUploading}
      />

      <Field label="Name" name="name" required defaultValue={values.name} />
      <Field
        label="Headline / job title"
        name="headline"
        placeholder="Solicitor · Partner"
        defaultValue={values.headline}
      />
      <Field
        label="Business name"
        name="businessName"
        defaultValue={values.businessName}
      />
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Bio</span>
        <textarea
          name="bio"
          rows={variant === "inline" ? 3 : 4}
          maxLength={600}
          defaultValue={values.bio}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
          placeholder="A short introduction for people booking with you."
        />
        <span className="text-xs text-muted">Up to 600 characters</span>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Timezone</span>
        <select
          name="timezone"
          required
          defaultValue={values.timezone || "Europe/London"}
          className="w-full rounded-md border border-line bg-white px-3 py-2"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {TIMEZONE_LABELS[tz] ?? tz}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">
          How far ahead guests can book
        </span>
        <div className="flex items-center gap-2">
          <input
            name="bookingHorizonDays"
            type="number"
            min={1}
            max={365}
            required
            defaultValue={values.bookingHorizonDays ?? 60}
            className="w-28 rounded-md border border-line bg-white px-3 py-2"
          />
          <span className="text-sm text-muted">days (1–365)</span>
        </div>
        <span className="text-xs text-muted">
          Default is 60 days. Availability beyond this window is not offered.
        </span>
      </label>

      <div className="space-y-3 border-t border-line pt-4">
        <p className="text-sm font-semibold">Contact (optional, public)</p>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Public email</span>
          <input
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            name="publicEmail"
            type="email"
            placeholder="you@example.com"
            value={contactFields.publicEmail}
            onChange={(e) =>
              setContactFields((prev) => ({
                ...prev,
                publicEmail: e.target.value,
              }))
            }
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Phone</span>
          <input
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            name="phone"
            type="tel"
            placeholder="+44 …"
            value={contactFields.phone}
            onChange={(e) =>
              setContactFields((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">WhatsApp</span>
          <input
            className="w-full rounded-md border border-line bg-white px-3 py-2"
            name="whatsappUrl"
            type="text"
            placeholder="+44 … or https://wa.me/…"
            value={contactFields.whatsappUrl}
            onChange={(e) =>
              setContactFields((prev) => ({
                ...prev,
                whatsappUrl: e.target.value,
              }))
            }
          />
          <span className="text-xs text-muted">
            Mobile number or WhatsApp link — opens chat in WhatsApp.
          </span>
        </label>
        <Field
          label="Website"
          name="websiteUrl"
          type="url"
          placeholder="https://"
          defaultValue={values.websiteUrl}
        />
        {linksFirst ? (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="contactRowEnabled"
              className="mt-0.5"
              checked={contactRowEnabled}
              disabled={contactFieldCount < 2}
              onChange={(e) => setContactRowEnabled(e.target.checked)}
            />
            <span>
              <span className="font-medium">Show contact icons on tree profile</span>
              <span className="mt-0.5 block text-xs text-muted">
                {contactFieldCount < 2
                  ? "Add at least two of phone, email, or WhatsApp to show a contact row above your links."
                  : "Phone, email, and WhatsApp appear as icons in a row (not in the main button list)."}
              </span>
            </span>
          </label>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <div>
          <p className="text-sm font-semibold">Social links (optional)</p>
          <p className="mt-1 text-xs text-muted">
            Use the arrows to choose the order icons appear on your profile.
          </p>
        </div>
        <ul className="space-y-3">
          {socialMediaOrder.map((key, index) => {
            const meta = SOCIAL_LINK_META.find((m) => m.key === key)!;
            const Icon = meta.Icon;
            return (
              <li
                key={key}
                className="flex items-start gap-2 rounded-md border border-line bg-white p-2"
              >
                <div className="flex flex-col gap-1 pt-1">
                  <button
                    type="button"
                    className="rounded border border-line px-1.5 text-xs leading-none hover:bg-accent-soft disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => moveSocial(key, -1)}
                    aria-label={`Move ${meta.label} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded border border-line px-1.5 text-xs leading-none hover:bg-accent-soft disabled:opacity-30"
                    disabled={index === socialMediaOrder.length - 1}
                    onClick={() => moveSocial(key, 1)}
                    aria-label={`Move ${meta.label} down`}
                  >
                    ↓
                  </button>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <Icon />
                    {meta.label}
                  </span>
                  <input
                    className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                    name={key}
                    type="url"
                    placeholder="https://"
                    defaultValue={values[key] ?? ""}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <div>
          <p className="text-sm font-semibold">Profile layout</p>
          <p className="mt-1 text-xs text-muted">
            Standard shows meeting types first; Tree is a stacked link page with
            in-page booking.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="profileLayoutMode"
              value="BOOK_FIRST"
              checked={layoutMode === "BOOK_FIRST"}
              onChange={() => setLayoutMode("BOOK_FIRST")}
            />
            Standard layout
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="profileLayoutMode"
              value="LINKS_FIRST"
              checked={layoutMode === "LINKS_FIRST"}
              onChange={() => setLayoutMode("LINKS_FIRST")}
            />
            Tree layout
          </label>
        </div>
      </div>

      {linksFirst ? (
        <div className="space-y-3 border-t border-line pt-4">
          <div>
            <p className="text-sm font-semibold">Page style</p>
            <p className="mt-1 text-xs text-muted">
              Background, accent colour, and button style for your tree layout
              profile.
            </p>
          </div>
          <ProfileThemeEditor theme={profileTheme} onChange={setProfileTheme} />
        </div>
      ) : (
        <input
          type="hidden"
          name="profileThemeJson"
          value={stringifyProfileTheme(profileTheme)}
        />
      )}

      <div className="space-y-3 border-t border-line pt-4">
        <div>
          <p className="text-sm font-semibold">Custom links (optional)</p>
          <p className="mt-1 text-xs text-muted">
            Up to 20 links — https, mailto, or tel URLs.
          </p>
        </div>
        <ProfileLinksManager
          links={editorLinks(links)}
          onLinksChange={() => router.refresh()}
          onLinkAdded={(link) => {
            setManagedLinks((prev) => [...prev, link]);
            setProfileStackOrder((prev) => {
              const key = `link:${link.id}`;
              if (
                prev.some(
                  (e) => e.type === "link" && e.linkId === link.id,
                )
              ) {
                return prev;
              }
              return [...prev, { type: "link", linkId: link.id }];
            });
          }}
          onLinkRemoved={(id) => {
            setManagedLinks((prev) => prev.filter((l) => l.id !== id));
            setProfileStackOrder((prev) =>
              prev.filter((e) => e.type !== "link" || e.linkId !== id),
            );
          }}
          onLinkUpdated={(link) =>
            setManagedLinks((prev) =>
              prev.map((l) => (l.id === link.id ? link : l)),
            )
          }
        />
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <div>
          <p className="text-sm font-semibold">
            {linksFirst ? "Button order" : "Custom link order"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {linksFirst
              ? contactRowWouldShow
                ? "Reorder links and the book button. Phone and email are in the contact row above."
                : "Reorder links, contact details, and the book button on your tree profile."
              : "Reorder custom links shown under your bio."}
          </p>
        </div>
        <ProfileStackEditor
          entries={
            linksFirst
              ? profileStackOrder
              : profileStackOrder.filter((e) => e.type === "link")
          }
          links={editorLinks(links)}
          socialValues={socialValues}
          linksFirst={linksFirst}
          onChange={(next) => {
            if (linksFirst) {
              setProfileStackOrder(next);
              return;
            }
            const nonLinks = profileStackOrder.filter((e) => e.type !== "link");
            setProfileStackOrder([...next, ...nonLinks]);
          }}
          hideStackSocialKeys={
            contactRowWouldShow ? CONTACT_ROW_SOCIAL_KEYS : undefined
          }
        />
      </div>

      {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-accent">{state.success}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending || avatarUploading}
        className="rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : avatarUploading ? "Uploading photo…" : "Save profile"}
      </button>
    </form>
  );
}

function stackHostFields(values: ProfileFormValues) {
  return {
    websiteUrl: values.websiteUrl,
    publicEmail: values.publicEmail,
    phone: values.phone,
    whatsappUrl: values.whatsappUrl ?? "",
    linkedinUrl: values.linkedinUrl,
    facebookUrl: values.facebookUrl,
    instagramUrl: values.instagramUrl,
    tiktokUrl: values.tiktokUrl,
    xUrl: values.xUrl,
    youtubeUrl: values.youtubeUrl,
    socialOrderJson: JSON.stringify(values.socialOrder),
  };
}

function AvatarField({
  savedPath,
  displayName,
  onUploaded,
  onUploadStateChange,
}: {
  savedPath: string | null;
  displayName: string;
  onUploaded?: () => void;
  onUploadStateChange?: (uploading: boolean) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeChecked, setRemoveChecked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(savedPath);

  useEffect(() => {
    setCurrentPath(savedPath);
  }, [savedPath]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const shownUrl = removeChecked ? null : previewUrl || currentPath;

  async function uploadPhoto(file: File) {
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError("Photo must be 2 MB or smaller");
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    const name = file.name.toLowerCase();
    const extOk =
      allowed.includes(file.type) ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".png") ||
      name.endsWith(".webp");
    if (!extOk) {
      setUploadError("Photo must be a JPEG, PNG, or WebP image");
      return;
    }

    setUploading(true);
    setUploadError(null);
    onUploadStateChange?.(true);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch("/api/host/avatar", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        avatarPath?: string;
      };

      if (!res.ok) {
        setUploadError(data.error ?? "Could not upload photo");
        return;
      }

      if (data.avatarPath) {
        setCurrentPath(data.avatarPath);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        onUploaded?.();
      }
    } catch {
      setUploadError("Could not upload photo. Check your connection and try again.");
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      {shownUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownUrl}
          alt=""
          className="h-28 w-28 rounded-full object-cover ring-1 ring-line"
        />
      ) : (
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-accent-soft text-2xl font-semibold text-accent ring-1 ring-line">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="space-y-2 text-sm">
        <label className="block">
          <span className="font-medium">Profile photo</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            className="mt-1 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-60"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setRemoveChecked(false);
              if (!file) return;

              setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return URL.createObjectURL(file);
              });

              void uploadPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
        {uploading ? (
          <p className="text-xs text-muted">Uploading photo…</p>
        ) : null}
        {uploadError ? (
          <p className="text-xs text-red-700">{uploadError}</p>
        ) : null}
        {currentPath || previewUrl ? (
          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              name="removeAvatar"
              checked={removeChecked}
              onChange={(e) => {
                setRemoveChecked(e.target.checked);
                if (e.target.checked) {
                  setPreviewUrl((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return null;
                  });
                }
              }}
            />
            Remove current photo
          </label>
        ) : null}
        <p className="text-xs text-muted">
          JPEG, PNG, or WebP · max 2 MB · uploads when you choose a file
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        className="w-full rounded-md border border-line bg-white px-3 py-2"
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}
