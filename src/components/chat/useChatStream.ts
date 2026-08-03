import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useChatStream(chatId: string, onDone: () => void | Promise<void>) {
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const running = useRef(false);

  const stop = useCallback(() => abort.current?.abort(), []);

  const run = useCallback(
    async (
      model: string,
      context?: string,
      files?: { path: string; lang: string; code: string }[],
    ) => {
      if (running.current) return;
      running.current = true;
      setError(null);
      setStreaming("");
      const controller = new AbortController();
      abort.current = controller;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) throw new Error("Session expired. Please sign in again.");

        const res = await fetch("/api/chat", {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({ chatId, model, context, files }),
        });

        if (!res.ok || !res.body) throw new Error((await res.text()) || `Stream failed (${res.status})`);

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setStreaming(acc);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const msg = e instanceof Error ? e.message : "stream failed";
          setError(msg);
          toast.error(msg);
        }
      } finally {
        abort.current = null;
        // Keep the streamed text on screen until the persisted message has been
        // refetched, otherwise the answer visibly disappears for a moment.
        try {
          await onDone();
        } finally {
          setStreaming(null);
          running.current = false;
        }
      }
    },
    [chatId, onDone],
  );

  return { streaming, error, run, stop };
}

