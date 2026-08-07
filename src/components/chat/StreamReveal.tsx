import { useEffect, useMemo, useRef } from "react";

/**
 * ChatGPT-style progressive reveal: each newly streamed word fades in from a
 * blur. Words that were already on screen render as plain text so nothing
 * re-animates and the paragraph never reflows.
 */
export function Reveal({ text, active }: { text: string; active?: boolean }) {
  const seen = useRef(0);
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  useEffect(() => {
    if (active) seen.current = words.length;
    else seen.current = 0;
  }, [words.length, active]);

  if (!active) return <>{text}</>;

  const start = seen.current;
  return (
    <>
      {words.map((w, i) =>
        i < start ? (
          w
        ) : (
          <span key={i} className="oc-reveal">
            {w}
          </span>
        ),
      )}
    </>
  );
}
