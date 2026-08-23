"use client";

import {
  BACKGROUND_PRESET_META,
  BUTTON_PRESET_META,
  DEFAULT_PROFILE_THEME,
  parseProfileTheme,
  resolveProfileTheme,
  stringifyProfileTheme,
  type ProfileTheme,
} from "@/lib/profile-theme";
import { ProfileLinkButtonList } from "@/components/profile-link-button";
import { ProfileThemeShell } from "@/components/profile-theme-shell";

const SAMPLE_BUTTONS = [
  {
    id: "sample-1",
    label: "Sample link",
    href: "#",
    kind: "link" as const,
  },
  {
    id: "social-linkedinUrl",
    label: "LinkedIn",
    href: "#",
    kind: "social" as const,
    socialKey: "linkedinUrl" as const,
  },
  { id: "book", label: "Book a meeting", kind: "book" as const },
];

export function ProfileThemeEditor({
  theme,
  onChange,
}: {
  theme: ProfileTheme;
  onChange: (next: ProfileTheme) => void;
}) {
  const resolved = resolveProfileTheme(theme);

  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name="profileThemeJson"
        value={stringifyProfileTheme(theme)}
      />

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Theme colour</span>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={theme.themeColor}
            onChange={(e) =>
              onChange({ ...theme, themeColor: e.target.value })
            }
            className="h-10 w-14 cursor-pointer rounded border border-line bg-white p-1"
            aria-label="Theme colour"
          />
          <input
            type="text"
            value={theme.themeColor}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
                onChange({ ...theme, themeColor: v });
              }
            }}
            className="w-28 rounded-md border border-line bg-white px-3 py-2 text-sm font-mono"
            pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
          />
        </div>
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium">Background</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BACKGROUND_PRESET_META.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                onChange({ ...theme, backgroundPreset: preset.id })
              }
              className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left text-xs transition ${
                theme.backgroundPreset === preset.id
                  ? "border-accent bg-accent-soft ring-1 ring-accent"
                  : "border-line bg-white hover:bg-accent-soft/40"
              }`}
            >
              <span
                className="h-6 w-6 shrink-0 rounded border border-line"
                style={{ background: preset.swatch }}
                aria-hidden
              />
              <span className="font-medium">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">Button style</span>
        <div className="flex flex-wrap gap-2">
          {BUTTON_PRESET_META.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ ...theme, buttonPreset: preset.id })}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                theme.buttonPreset === preset.id
                  ? "border-accent bg-accent-soft text-foreground"
                  : "border-line bg-white hover:bg-accent-soft/40"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={theme.showSocialIconsOnButtons}
          onChange={(e) =>
            onChange({ ...theme, showSocialIconsOnButtons: e.target.checked })
          }
        />
        Show icons on social link buttons
      </label>

      <div className="space-y-2">
        <span className="text-sm font-medium">Preview</span>
        <ProfileThemeShell
          theme={resolved}
          className="rounded-lg border border-line p-4"
        >
          <div className="mx-auto max-w-xs space-y-3 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold"
              style={{
                background: "var(--profile-accent-soft)",
                color: "var(--profile-accent)",
              }}
            >
              Y
            </div>
            <p className="font-serif text-lg" style={{ color: "var(--profile-fg)" }}>
              Your name
            </p>
            <p className="text-sm" style={{ color: "var(--profile-muted)" }}>
              Short bio preview
            </p>
            <ProfileLinkButtonList items={SAMPLE_BUTTONS} theme={resolved} />
          </div>
        </ProfileThemeShell>
      </div>
    </div>
  );
}

export function profileThemeFromInitial(json: string | undefined): ProfileTheme {
  return parseProfileTheme(json ?? stringifyProfileTheme(DEFAULT_PROFILE_THEME));
}
