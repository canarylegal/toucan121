export type ActionPoint = {
  id: string;
  text: string;
  done: boolean;
};

/** Parse stored JSON (or legacy plain text) into action points. */
export function parseActionPoints(raw: string | null | undefined): ActionPoint[] {
  const value = (raw ?? "").trim();
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item, index) => {
          if (!item || typeof item !== "object") return null;
          const row = item as { id?: unknown; text?: unknown; done?: unknown };
          const text = String(row.text ?? "").trim();
          if (!text) return null;
          return {
            id: String(row.id ?? `ap-${index}`),
            text,
            done: Boolean(row.done),
          };
        })
        .filter((x): x is ActionPoint => x !== null);
    }
  } catch {
    // Legacy single free-text blob
  }

  return [
    {
      id: "legacy-0",
      text: value,
      done: false,
    },
  ];
}

export function stringifyActionPoints(points: ActionPoint[]): string {
  return JSON.stringify(points);
}

export function actionPointsAllDone(points: ActionPoint[]): boolean {
  return points.length === 0 || points.every((p) => p.done);
}

export function actionPointsFromTexts(texts: string[]): ActionPoint[] {
  return texts
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({
      id: crypto.randomUUID(),
      text,
      done: false,
    }));
}
