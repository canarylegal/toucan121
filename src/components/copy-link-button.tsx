"use client";

import { useState } from "react";

type Props = {
  value: string;
};

export function CopyLinkButton({ value }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-md border border-line bg-panel px-3 py-1.5 text-xs font-semibold hover:bg-accent-soft"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
