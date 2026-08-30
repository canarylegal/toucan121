"use client";

import { useRef, useState } from "react";
import type { ProfileStackEntry } from "@/lib/profile-stack";
import { stackEntryKey } from "@/lib/profile-stack";
import type { SocialLinkKey } from "@/components/social-icons";
import { SOCIAL_LINK_META } from "@/components/social-icons";
import { HostLinkIconFields } from "@/components/host-link-icon-fields";
import {
  addHostLinkAction,
  deleteHostLinkAction,
  updateHostLinkAction,
} from "@/lib/host-link-actions";

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
  hideStackSocialKeys?: SocialLinkKey[],
): string | null {
  if (entry.type === "book") return "Book a meeting";
  if (entry.type === "social") {
    if (hideStackSocialKeys?.includes(entry.key)) return null;
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
  hideStackSocialKeys,
}: {
  entries: ProfileStackEntry[];
  links: LinkRow[];
  socialValues: Partial<Record<SocialLinkKey, string>>;
  linksFirst: boolean;
  onChange: (next: ProfileStackEntry[]) => void;
  hideStackSocialKeys?: SocialLinkKey[];
}) {
  const rows: StackRow[] = entries
    .map((entry) => {
      const label = labelForEntry(
        entry,
        links,
        socialValues,
        hideStackSocialKeys,
      );
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

function collectFields(root: HTMLElement): FormData {
  const fd = new FormData();
  root.querySelectorAll("input, select, textarea").forEach((el) => {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) {
      return;
    }
    if (!el.name || el.type === "button" || el.type === "submit") return;
    fd.append(el.name, el.value);
  });
  return fd;
}

export function ProfileLinksManager({
  links,
  onLinksChange,
  onLinkAdded,
  onLinkRemoved,
  onLinkUpdated,
}: {
  links: LinkRow[];
  onLinksChange?: () => void;
  onLinkAdded?: (link: LinkRow) => void;
  onLinkRemoved?: (linkId: string) => void;
  onLinkUpdated?: (link: LinkRow) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [addFormKey, setAddFormKey] = useState(0);
  const addFormRef = useRef<HTMLDivElement>(null);

  async function handleAddLink() {
    const root = addFormRef.current;
    if (!root) {
      setError("Could not read link fields — try again");
      return;
    }

    const title = (
      root.querySelector<HTMLInputElement>('input[data-field="title"]')?.value ??
      ""
    ).trim();
    const url = (
      root.querySelector<HTMLInputElement>('input[data-field="url"]')?.value ??
      ""
    ).trim();

    if (!title) {
      setError("Enter a link title");
      return;
    }
    if (!url) {
      setError("Enter a URL");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const fd = collectFields(root);
      fd.set("title", title);
      fd.set("url", url);
      const created = await addHostLinkAction(fd);
      onLinkAdded?.(created);
      setAddFormKey((k) => k + 1);
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
              className="space-y-2 rounded-md border border-line bg-white p-3"
            >
              <LinkEditRow
                link={link}
                pending={pending}
                onError={setError}
                onSuccess={(updated) => {
                  onLinkUpdated?.(updated);
                  onLinksChange?.();
                }}
                onRemoved={() => {
                  onLinkRemoved?.(link.id);
                  onLinksChange?.();
                }}
                onPending={setPending}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={addFormRef}
        key={addFormKey}
        className="space-y-2 rounded-md border border-dashed border-line bg-panel/50 p-3"
      >
        <p className="text-sm font-medium">Add a link</p>
        <input
          data-field="title"
          maxLength={80}
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
          placeholder="e.g. My blog"
        />
        <input
          data-field="url"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
          placeholder="https:// or mailto: or tel:"
        />
        <HostLinkIconFields />
        <button
          type="button"
          disabled={pending || links.length >= 20}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleAddLink();
          }}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add link"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function LinkEditRow({
  link,
  pending,
  onError,
  onSuccess,
  onRemoved,
  onPending,
}: {
  link: LinkRow;
  pending: boolean;
  onError: (msg: string | null) => void;
  onSuccess?: (link: LinkRow) => void;
  onRemoved?: () => void;
  onPending: (v: boolean) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    const root = rowRef.current;
    if (!root) return;
    onPending(true);
    onError(null);
    try {
      const fd = collectFields(root);
      fd.set("linkId", link.id);
      await updateHostLinkAction(fd);
      const title =
        root.querySelector<HTMLInputElement>('[data-field="title"]')?.value ??
        link.title;
      const url =
        root.querySelector<HTMLInputElement>('[data-field="url"]')?.value ??
        link.url;
      const iconKey =
        root.querySelector<HTMLInputElement>('input[name="iconKey"]')?.value ??
        link.iconKey;
      const emoji =
        root.querySelector<HTMLInputElement>('input[name="emoji"]')?.value ??
        link.emoji;
      onSuccess?.({
        id: link.id,
        title,
        url,
        iconKey,
        emoji,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save link");
    } finally {
      onPending(false);
    }
  }

  async function handleRemove() {
    onPending(true);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("linkId", link.id);
      await deleteHostLinkAction(fd);
      onRemoved?.();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save link");
    } finally {
      onPending(false);
    }
  }

  return (
    <div ref={rowRef} className="space-y-2">
      <input
        data-field="title"
        defaultValue={link.title}
        maxLength={80}
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
        placeholder="Link title"
      />
      <input
        data-field="url"
        defaultValue={link.url}
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
        placeholder="https:// or mailto: or tel:"
      />
      <HostLinkIconFields
        defaultIconKey={link.iconKey}
        defaultEmoji={link.emoji}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleSave();
          }}
          className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
        >
          Save link
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleRemove();
          }}
          className="text-xs font-medium text-muted underline hover:text-foreground"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
