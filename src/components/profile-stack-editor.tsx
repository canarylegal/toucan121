"use client";

import { useState } from "react";
import type { ProfileStackEntry } from "@/lib/profile-stack";
import { stackEntryKey } from "@/lib/profile-stack";
import type { SocialLinkKey } from "@/components/social-icons";
import { SOCIAL_LINK_META } from "@/components/social-icons";
import { HostLinkIconFields } from "@/components/host-link-icon-fields";

type LinkRow = {
  id: string;
  title: string;
  url: string;
  iconKey: string;
  emoji: string;
};

type StackRow = {
  key: string;
  label: string;
  entry: ProfileStackEntry;
};

function labelForEntry(
  entry: ProfileStackEntry,
  links: LinkRow[],
  socialValues: Partial<Record<SocialLinkKey, string>>,
): string | null {
  if (entry.type === "book") return "Book a meeting";
  if (entry.type === "social") {
    if (!socialValues[entry.key]?.trim()) return null;
    return SOCIAL_LINK_META.find((m) => m.key === entry.key)?.label ?? entry.key;
  }
  const link = links.find((l) => l.id === entry.linkId);
  return link ? link.title : null;
}

export function ProfileStackEditor({
  entries,
  links,
  socialValues,
  linksFirst,
  onChange,
}: {
  entries: ProfileStackEntry[];
  links: LinkRow[];
  socialValues: Partial<Record<SocialLinkKey, string>>;
  linksFirst: boolean;
  onChange: (next: ProfileStackEntry[]) => void;
}) {
  const rows: StackRow[] = entries
    .map((entry) => {
      const label = labelForEntry(entry, links, socialValues);
      if (!label) return null;
      return { key: stackEntryKey(entry), label, entry };
    })
    .filter((r): r is StackRow => Boolean(r));

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= rows.length) return;
    const reordered = [...entries];
    const aKey = rows[index]!.key;
    const bKey = rows[next]!.key;
    const aIdx = reordered.findIndex((e) => stackEntryKey(e) === aKey);
    const bIdx = reordered.findIndex((e) => stackEntryKey(e) === bKey);
    if (aIdx < 0 || bIdx < 0) return;
    const tmp = reordered[aIdx]!;
    reordered[aIdx] = reordered[bIdx]!;
    reordered[bIdx] = tmp;
    onChange(reordered);
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        {linksFirst
          ? "Add links or contact details above — they will appear as buttons on your profile."
          : "Add custom links below to show them on your profile."}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row, index) => (
        <li
          key={row.key}
          className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm"
        >
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="rounded border border-line px-1.5 text-xs leading-none hover:bg-accent-soft disabled:opacity-30"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={`Move ${row.label} up`}
            >
              ↑
            </button>
            <button
              type="button"
              className="rounded border border-line px-1.5 text-xs leading-none hover:bg-accent-soft disabled:opacity-30"
              disabled={index === rows.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`Move ${row.label} down`}
            >
              ↓
            </button>
          </div>
          <span className="min-w-0 flex-1 font-medium">{row.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function ProfileLinksManager({
  links,
  onLinksChange,
}: {
  links: LinkRow[];
  onLinksChange?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitAction(
    action: (formData: FormData) => Promise<void>,
    formData: FormData,
  ) {
    setPending(true);
    setError(null);
    try {
      await action(formData);
      onLinksChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save link");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {links.length > 0 ? (
        <ul className="space-y-3">
          {links.map((link) => (
            <li
              key={link.id}
              className="rounded-md border border-line bg-white p-3 space-y-2"
            >
              <form
                action={(fd) =>
                  submitAction(async (data) => {
                    const { updateHostLinkAction } = await import(
                      "@/lib/host-link-actions"
                    );
                    await updateHostLinkAction(data);
                  }, fd)
                }
                className="space-y-2"
              >
                <input type="hidden" name="linkId" value={link.id} />
                <input
                  name="title"
                  defaultValue={link.title}
                  required
                  maxLength={80}
                  className="w-full rounded-md border border-line px-3 py-2 text-sm"
                  placeholder="Link title"
                />
                <input
                  name="url"
                  type="url"
                  defaultValue={link.url}
                  required
                  className="w-full rounded-md border border-line px-3 py-2 text-sm"
                  placeholder="https:// or mailto: or tel:"
                />
                <HostLinkIconFields
                  defaultIconKey={link.iconKey}
                  defaultEmoji={link.emoji}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
                  >
                    Save link
                  </button>
                </div>
              </form>
              <form
                action={(fd) =>
                  submitAction(async (data) => {
                    const { deleteHostLinkAction } = await import(
                      "@/lib/host-link-actions"
                    );
                    await deleteHostLinkAction(data);
                  }, fd)
                }
              >
                <input type="hidden" name="linkId" value={link.id} />
                <button
                  type="submit"
                  disabled={pending}
                  className="text-xs font-medium text-muted underline hover:text-foreground"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        action={(fd) =>
          submitAction(async (data) => {
            const { addHostLinkAction } = await import("@/lib/host-link-actions");
            await addHostLinkAction(data);
          }, fd)
        }
        className="space-y-2 rounded-md border border-dashed border-line bg-panel/50 p-3"
      >
        <p className="text-sm font-medium">Add a link</p>
        <input
          name="title"
          required
          maxLength={80}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
          placeholder="e.g. My blog"
        />
        <input
          name="url"
          required
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
          placeholder="https:// or mailto: or tel:"
        />
        <HostLinkIconFields />
        <button
          type="submit"
          disabled={pending || links.length >= 20}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Add link
        </button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
