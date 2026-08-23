"use client";

import { useState } from "react";
import {
  HOST_LINK_EMOJI_PRESETS,
  HOST_LINK_ICON_META,
  type HostLinkIconKey,
  parseHostLinkIconKey,
} from "@/lib/link-icons";
import { HostLinkIcon } from "@/components/link-icons";

export function HostLinkIconFields({
  defaultIconKey = "link",
  defaultEmoji = "",
}: {
  defaultIconKey?: string;
  defaultEmoji?: string;
}) {
  const [iconKey, setIconKey] = useState<HostLinkIconKey>(
    parseHostLinkIconKey(defaultIconKey),
  );
  const [emoji, setEmoji] = useState(defaultEmoji.trim());

  return (
    <div className="space-y-3">
      <input type="hidden" name="iconKey" value={iconKey} />
      <div>
        <p className="text-xs font-medium text-muted">Button icon</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HOST_LINK_ICON_META.map((meta) => {
            const selected = iconKey === meta.key && !emoji;
            return (
              <button
                key={meta.key}
                type="button"
                title={meta.label}
                onClick={() => {
                  setIconKey(meta.key);
                  setEmoji("");
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-md border transition ${
                  selected
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-line bg-white text-foreground hover:bg-accent-soft/50"
                }`}
                aria-label={meta.label}
                aria-pressed={selected}
              >
                <HostLinkIcon keyName={meta.key} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted">
          Or emoji (overrides icon)
        </label>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {HOST_LINK_EMOJI_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setEmoji(preset)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg leading-none transition ${
                emoji === preset
                  ? "border-accent bg-accent-soft"
                  : "border-line bg-white hover:bg-accent-soft/50"
              }`}
              aria-label={`Use ${preset}`}
            >
              {preset}
            </button>
          ))}
          <input
            name="emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            placeholder="Emoji"
            className="h-9 w-20 rounded-md border border-line bg-white px-2 text-center text-base"
          />
          {emoji ? (
            <button
              type="button"
              onClick={() => setEmoji("")}
              className="text-xs font-medium text-muted underline hover:text-foreground"
            >
              Clear emoji
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
