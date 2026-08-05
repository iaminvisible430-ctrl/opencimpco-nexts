export type StepKind =
  | "plan"
  | "search"
  | "read"
  | "file"
  | "write"
  | "edit"
  | "rm"
  | "check"
  | "selftest"
  | "verify"
  | "resume"
  | "fallback"
  | "tool";
export type StepState = "active" | "done" | "error";

export type AgentStep = {
  id: string;
  kind: StepKind;
  label: string;
  detail?: string;
  state: StepState;
};

/** Any machine-readable activity marker the server pushes into the stream. */
const MARKER = /\[\[oc:([a-z_]+):([^\]]*)\]\]/g;

const LABELS: Record<string, { kind: StepKind; label: string }> = {
  search: { kind: "search", label: "Searching the web" },
  read: { kind: "read", label: "Reading documentation" },
  ls: { kind: "check", label: "Listing project files" },
  cat: { kind: "read", label: "Reading project file" },
  write: { kind: "write", label: "Writing file" },
  edit: { kind: "edit", label: "Editing file" },
  rm: { kind: "rm", label: "Deleting file" },
  check: { kind: "check", label: "Checking the project" },
  resume: { kind: "resume", label: "Resuming from where it paused" },
  fallback: { kind: "fallback", label: "Switching model" },
  salvage: { kind: "tool", label: "Recovered a tool call" },
  tool: { kind: "tool", label: "Running tool" },
};

/** Result markers close the step that opened just before them. */
const RESULTS: Record<string, StepState> = { ok: "done", err: "error" };

/**
 * Some providers leak raw tool-call scaffolding into the text channel instead of
 * the tool channel. Never show that to the user.
 */
const TOOL_NOISE = [
  /<tool_call>[\s\S]*?<\/tool_call>/g,
  /<tool_call>[\s\S]*$/g,
  /<tool_response>[\s\S]*?<\/tool_response>/g,
  /<\|tool_calls?_(?:begin|section_begin)\|>[\s\S]*?<\|tool_calls?_(?:end|section_end)\|>/g,
  /<\|(?:python_tag|tool▁calls▁begin|tool▁calls▁end|tool▁call▁begin|tool▁sep)\|>/g,
  /<function=[^>]*>[\s\S]*?<\/function>/g,
  /```(?:json|tool_code|tool_call)?\s*\{\s*"(?:name|tool_name|function|tool)"\s*:\s*"(?:web_search|fetch_page|list_files|read_file|write_file|edit_file|delete_file|check_project|run_command)"[\s\S]*?```/g,
  /^\s*\{"(?:name|tool_name|function|tool)"\s*:\s*"(?:web_search|fetch_page|list_files|read_file|write_file|edit_file|delete_file|check_project|run_command)"[\s\S]*?\}\s*$/gm,
];

/** Strip markers and provider tool noise out of displayable text. */
export function stripMarkers(text: string): string {
  let out = text.replace(MARKER, "");
  for (const re of TOOL_NOISE) out = out.replace(re, "");
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

const FENCE_OPEN = /^\s*```([^\n`]*)$/gm;

function fileLabel(info: string, index: number): string {
  const tokens = info.trim().split(/\s+/).filter(Boolean);
  const path = tokens.find((t) => /\.[a-zA-Z0-9]+$/.test(t.replace(/^file=/, "")));
  if (path) return path.replace(/^file=/, "");
  return tokens[0] ? `${tokens[0]} snippet` : `file ${index + 1}`;
}

/**
 * Derive a live activity timeline from the streaming assistant text so the UI can
 * show shimmering "Planning / Searching / Writing file / Self-test" rows, each of
 * which resolves to a tick (or an error) once its result marker arrives.
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

  let n = 0;
  const pending: AgentStep[] = [];
  for (const m of raw.matchAll(new RegExp(MARKER))) {
    const tag = m[1];
    const payload = m[2]?.trim() || "";
    const result = RESULTS[tag];
    if (result) {
      const step = pending.pop();
      if (step) {
        step.state = result;
        if (payload) step.detail = payload;
      }
      continue;
    }
    const meta = LABELS[tag];
    if (!meta) continue;
    const step: AgentStep = {
      id: `mk-${n++}`,
      kind: meta.kind,
      label: meta.label,
      detail: payload || undefined,
      state: "active",
    };
    steps.push(step);
    pending.push(step);
  }
  // Anything still open when the stream has ended simply completed.
  if (!streaming) for (const s of pending) s.state = "done";
  else for (const s of pending.slice(0, -1)) s.state = "done";

  // Count fence boundaries to know whether the last file is still being written.
  const fenceCount = (raw.match(/^\s*```/gm) ?? []).length;
  const openInfos = [...raw.matchAll(new RegExp(FENCE_OPEN))]
    .map((m) => m[1])
    .filter((info) => info.trim().length > 0);
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
