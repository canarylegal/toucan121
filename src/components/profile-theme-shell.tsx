import type { CSSProperties, ReactNode } from "react";
import type { ResolvedProfileTheme } from "@/lib/profile-theme";

export function ProfileThemeShell({
  theme,
  className = "",
  children,
}: {
  theme: ResolvedProfileTheme;
  className?: string;
  children: ReactNode;
}) {
  const bgClass = theme.backgroundClass;
  return (
    <div
      className={`profile-themed min-h-full ${bgClass} ${className}`.trim()}
      style={theme.cssVars as CSSProperties}
    >
      {children}
    </div>
  );
}
