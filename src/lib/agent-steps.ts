export type StepKind = "plan" | "search" | "file" | "selftest" | "verify";
export type StepState = "active" | "done";

export type AgentStep = {
  id: string;
  kind: StepKind;
  label: string;
  detail?: string;
  state: StepState;
};

const SEARCH = /\[\[oc:search:([^\]]*)\]\]/g;

/** Strip the machine-readable activity markers out of displayable text. */
export function stripMarkers(text: string): string {
  return text.replace(SEARCH, "").replace(/\n{3,}/g, "\n\n");
}

const FENCE_OPEN = /```([^\n`]*)\n/g;

function fileLabel(info: string, index: number): string {
  const tokens = info.trim().split(/\s+/).filter(Boolean);
  const path = tokens.find((t) => /\.[a-zA-Z0-9]+$/.test(t.replace(/^file=/, "")));
  if (path) return path.replace(/^file=/, "");
  return tokens[0] ? `${tokens[0]} snippet` : `file ${index + 1}`;
}

/**
 * Derive a live activity timeline from the streaming assistant text so the UI can
 * show shimmering "Planning / Searching / Writing file / Self-test" rows.
 */
export function deriveSteps(raw: string, streaming: boolean): AgentStep[] {
  const steps: AgentStep[] = [];
  const hasThinking = raw.includes("<thinking>");
  const thinkingClosed = raw.includes("</thinking>");
  if (hasThinking) {
    steps.push({
      id: "plan",
      kind: "plan",
      label: "Planning the build",
      state: streaming && !thinkingClosed ? "active" : "done",
    });
  }

  const searches = [...raw.matchAll(new RegExp(SEARCH))].map((m) => m[1]);
  searches.forEach((q, i) => {
    steps.push({
      id: `search-${i}`,
      kind: "search",
      label: "Searching the web",
      detail: q,
      state: "done",
    });
  });

  // Count fence boundaries to know whether the last file is still being written.
  const fenceCount = (raw.match(/```/g) ?? []).length;
  const openInfos = [...raw.matchAll(new RegExp(FENCE_OPEN))].map((m) => m[1]);
  const lastOpen = fenceCount % 2 === 1;
  openInfos.forEach((info, i) => {
    const isLast = i === openInfos.length - 1;
    steps.push({
      id: `file-${i}-${info}`,
      kind: "file",
      label: fileLabel(info, i),
      state: streaming && isLast && lastOpen ? "active" : "done",
    });
  });

  if (/(^|\n)#{0,4}\s*\**\s*Self-?test/i.test(raw)) {
    steps.push({
      id: "selftest",
      kind: "selftest",
      label: "Self-testing the code",
      state: streaming ? "active" : "done",
    });
  }
  if (/How to verify/i.test(raw)) {
    steps.push({
      id: "verify",
      kind: "verify",
      label: "Verifying in the preview",
      state: streaming ? "active" : "done",
    });
  }
  return steps;
}
