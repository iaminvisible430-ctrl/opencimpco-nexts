import { useCallback, useEffect, useState } from "react";

/**
 * Manual editor changes live outside the chat transcript so they survive
 * regeneration and are shared between the preview, the terminal and the prompt.
 */
export type Overrides = Record<string, string>;

const key = (chatId: string) => `oc-edits:${chatId}`;

export function loadOverrides(chatId: string): Overrides {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(key(chatId)) ?? "{}") as Overrides;
  } catch {
    return {};
  }
}

export function useOverrides(chatId: string) {
  const [overrides, setOverrides] = useState<Overrides>({});

  useEffect(() => setOverrides(loadOverrides(chatId)), [chatId]);

  const persist = useCallback(
    (next: Overrides) => {
      setOverrides(next);
      try {
        window.localStorage.setItem(key(chatId), JSON.stringify(next));
      } catch {
        /* storage full or unavailable — edits stay in memory */
      }
    },
    [chatId],
  );

  const saveFile = useCallback(
    (path: string, code: string) => persist({ ...loadOverrides(chatId), [path]: code }),
    [chatId, persist],
  );
  const resetFile = useCallback(
    (path: string) => {
      const next = { ...loadOverrides(chatId) };
      delete next[path];
      persist(next);
    },
    [chatId, persist],
  );

  return { overrides, saveFile, resetFile };
}
