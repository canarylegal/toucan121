import { z } from "zod";

export const BACKGROUND_PRESETS = [
  "cream",
  "white",
  "slate",
  "blush",
  "sky",
  "lavender",
  "sand",
  "forest",
  "navy",
  "charcoal",
  "coral",
  "gradient-mint",
  "gradient-warm",
  "paper",
  "grain",
] as const;

export const BUTTON_PRESETS = ["outline", "filled", "soft", "pill"] as const;

export type BackgroundPreset = (typeof BACKGROUND_PRESETS)[number];
export type ButtonPreset = (typeof BUTTON_PRESETS)[number];

export type ProfileTheme = {
  themeColor: string;
  backgroundPreset: BackgroundPreset;
  buttonPreset: ButtonPreset;
  showSocialIconsOnButtons: boolean;
};

export type ResolvedProfileTheme = ProfileTheme & {
  cssVars: Record<string, string>;
  backgroundClass: string;
  buttonClass: string;
  isDark: boolean;
};

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Pick a valid hex colour");

export const profileThemeSchema = z.object({
  themeColor: hexColorSchema.default("#0f6a4b"),
  backgroundPreset: z.enum(BACKGROUND_PRESETS).default("cream"),
  buttonPreset: z.enum(BUTTON_PRESETS).default("outline"),
  showSocialIconsOnButtons: z.boolean().default(false),
});

export const DEFAULT_PROFILE_THEME: ProfileTheme = profileThemeSchema.parse({});

export const BACKGROUND_PRESET_META: {
  id: BackgroundPreset;
  label: string;
  swatch: string;
}[] = [
  { id: "cream", label: "Cream", swatch: "#f3efe6" },
  { id: "white", label: "White", swatch: "#ffffff" },
  { id: "slate", label: "Slate", swatch: "#2d3748" },
  { id: "blush", label: "Blush", swatch: "#fce8ec" },
  { id: "sky", label: "Sky", swatch: "#e8f4fc" },
  { id: "lavender", label: "Lavender", swatch: "#ede9fe" },
  { id: "sand", label: "Sand", swatch: "#f5ebe0" },
  { id: "forest", label: "Forest", swatch: "#1a3d2e" },
  { id: "navy", label: "Navy", swatch: "#1e293b" },
  { id: "charcoal", label: "Charcoal", swatch: "#374151" },
  { id: "coral", label: "Coral", swatch: "#fff1eb" },
  { id: "gradient-mint", label: "Mint gradient", swatch: "#d7ebe2" },
  { id: "gradient-warm", label: "Warm gradient", swatch: "#efe6d4" },
  { id: "paper", label: "Paper", swatch: "#faf8f4" },
  { id: "grain", label: "Grain", swatch: "#ece8e0" },
];

export const BUTTON_PRESET_META: { id: ButtonPreset; label: string }[] = [
  { id: "outline", label: "Outline" },
  { id: "filled", label: "Filled" },
  { id: "soft", label: "Soft" },
  { id: "pill", label: "Pill" },
];

function expandHex(hex: string): string {
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  return hex.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = expandHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mix(hex1: string, hex2: string, weight: number): string {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    a.r + (b.r - a.r) * w,
    a.g + (b.g - a.g) * w,
    a.b + (b.b - a.b) * w,
  );
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!;
}

function softTint(accent: string, bg: string): string {
  return mix(bg, accent, 0.18);
}

type Palette = {
  background: string;
  foreground: string;
  panel: string;
  muted: string;
  line: string;
  isDark: boolean;
};

function paletteForBackground(preset: BackgroundPreset): Palette {
  switch (preset) {
    case "white":
      return {
        background: "#ffffff",
        foreground: "#1c2420",
        panel: "#ffffff",
        muted: "#5c6b63",
        line: "#e2e8f0",
        isDark: false,
      };
    case "slate":
      return {
        background: "#2d3748",
        foreground: "#f7fafc",
        panel: "#374151",
        muted: "#a0aec0",
        line: "#4a5568",
        isDark: true,
      };
    case "gradient-mint":
      return {
        background: "#e7f3ec",
        foreground: "#1c2420",
        panel: "#fffdf8",
        muted: "#5c6b63",
        line: "#c5ddd2",
        isDark: false,
      };
    case "gradient-warm":
      return {
        background: "#efe6d4",
        foreground: "#1c2420",
        panel: "#fffdf8",
        muted: "#5c6b63",
        line: "#d5cdc0",
        isDark: false,
      };
    case "paper":
      return {
        background: "#faf8f4",
        foreground: "#1c2420",
        panel: "#ffffff",
        muted: "#5c6b63",
        line: "#d5cdc0",
        isDark: false,
      };
    case "grain":
      return {
        background: "#ece8e0",
        foreground: "#1c2420",
        panel: "#fffdf8",
        muted: "#5c6b63",
        line: "#d5cdc0",
        isDark: false,
      };
    case "blush":
      return {
        background: "#fce8ec",
        foreground: "#1c2420",
        panel: "#ffffff",
        muted: "#6b5c63",
        line: "#e8cdd4",
        isDark: false,
      };
    case "sky":
      return {
        background: "#e8f4fc",
        foreground: "#1c2420",
        panel: "#ffffff",
        muted: "#5c6b73",
        line: "#c5dce8",
        isDark: false,
      };
    case "lavender":
      return {
        background: "#ede9fe",
        foreground: "#1c2420",
        panel: "#ffffff",
        muted: "#5c5c6b",
        line: "#d4cff0",
        isDark: false,
      };
    case "sand":
      return {
        background: "#f5ebe0",
        foreground: "#1c2420",
        panel: "#fffdf8",
        muted: "#6b635c",
        line: "#ddd0c0",
        isDark: false,
      };
    case "forest":
      return {
        background: "#1a3d2e",
        foreground: "#f0f7f4",
        panel: "#234a38",
        muted: "#a8c4b8",
        line: "#2d5a45",
        isDark: true,
      };
    case "navy":
      return {
        background: "#1e293b",
        foreground: "#f1f5f9",
        panel: "#273549",
        muted: "#94a3b8",
        line: "#334155",
        isDark: true,
      };
    case "charcoal":
      return {
        background: "#374151",
        foreground: "#f9fafb",
        panel: "#4b5563",
        muted: "#d1d5db",
        line: "#4b5563",
        isDark: true,
      };
    case "coral":
      return {
        background: "#fff1eb",
        foreground: "#1c2420",
        panel: "#ffffff",
        muted: "#6b5c58",
        line: "#f0d5c8",
        isDark: false,
      };
    case "cream":
    default:
      return {
        background: "#f3efe6",
        foreground: "#1c2420",
        panel: "#fffdf8",
        muted: "#5c6b63",
        line: "#d5cdc0",
        isDark: false,
      };
  }
}

function backgroundClassFor(preset: BackgroundPreset): string {
  switch (preset) {
    case "gradient-mint":
      return "profile-bg-gradient-mint";
    case "gradient-warm":
      return "profile-bg-gradient-warm";
    case "paper":
      return "profile-bg-paper";
    case "grain":
      return "profile-bg-grain";
    default:
      return "";
  }
}

function buttonClassFor(preset: ButtonPreset): string {
  const base =
    "profile-stack-button block w-full px-4 py-3.5 text-center text-sm font-semibold transition";
  const radius =
    preset === "pill" ? "rounded-full" : "rounded-lg";

  switch (preset) {
    case "filled":
      return `${base} ${radius} border border-transparent bg-[var(--profile-accent)] hover:opacity-90`;
    case "soft":
      return `${base} ${radius} border border-transparent bg-[var(--profile-accent-soft)] hover:opacity-90`;
    case "pill":
      return `${base} rounded-full border border-transparent bg-[var(--profile-accent)] hover:opacity-90`;
    case "outline":
    default:
      return `${base} ${radius} border border-[var(--profile-line)] bg-[var(--profile-panel)] hover:border-[var(--profile-accent)] hover:bg-[var(--profile-accent-soft)]`;
  }
}

/** Text colour for tree stack buttons (`<button>` does not inherit themed colour). */
export function stackButtonTextColor(theme: ProfileTheme): string {
  switch (theme.buttonPreset) {
    case "filled":
    case "pill":
      return "var(--profile-btn-fg)";
    case "soft":
      return "var(--profile-accent)";
    case "outline":
    default:
      return "var(--profile-fg)";
  }
}

export function parseProfileTheme(
  json: string | null | undefined,
): ProfileTheme {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json || "{}");
  } catch {
    return { ...DEFAULT_PROFILE_THEME };
  }
  const result = profileThemeSchema.safeParse(parsed);
  if (!result.success) return { ...DEFAULT_PROFILE_THEME };
  return result.data;
}

export function stringifyProfileTheme(theme: ProfileTheme): string {
  return JSON.stringify(theme);
}

export function resolveProfileTheme(theme: ProfileTheme): ResolvedProfileTheme {
  const accent = expandHex(theme.themeColor);
  const palette = paletteForBackground(theme.backgroundPreset);
  const accentSoft = softTint(accent, palette.background);
  const btnFg = luminance(accent) > 0.55 ? "#1c2420" : "#ffffff";

  const cssVars: Record<string, string> = {
    "--profile-bg": palette.background,
    "--profile-fg": palette.foreground,
    "--profile-panel": palette.panel,
    "--profile-muted": palette.muted,
    "--profile-line": palette.line,
    "--profile-accent": accent,
    "--profile-accent-soft": accentSoft,
    "--profile-btn-fg": btnFg,
  };

  return {
    ...theme,
    cssVars,
    backgroundClass: backgroundClassFor(theme.backgroundPreset),
    buttonClass: buttonClassFor(theme.buttonPreset),
    isDark: palette.isDark,
  };
}
