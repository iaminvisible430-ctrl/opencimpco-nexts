export type StepKind =
  | "plan"
  | "search"
  | "read"
  | "file"
  | "write"
  | "edit"
  | "rm"
  | "mv"
  | "install"
  | "cmd"
  | "lint"
  | "fmt"
  | "index"
  | "docs"
  | "build"
  | "check"
  | "selftest"
  | "verify"
  | "resume";
export type StepState = "active" | "done";

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
  mv: { kind: "mv", label: "Renaming file" },
  install: { kind: "install", label: "Installing dependency" },
  cmd: { kind: "cmd", label: "Running command" },
  lint: { kind: "lint", label: "Linting the project" },
  fmt: { kind: "fmt", label: "Formatting file" },
  index: { kind: "index", label: "Indexing the project" },
  docs: { kind: "docs", label: "Writing documentation" },
  build: { kind: "build", label: "Building the project" },
  check: { kind: "check", label: "Checking the project" },
  resume: { kind: "resume", label: "Resuming from where it paused" },
};

const TOOL_NAMES = [
  "web_search",
  "fetch_page",
  "list_files",
  "read_file",
  "write_file",
  "edit_file",
  "delete_file",
  "rename_file",
  "install_package",
  "run_command",
  "lint_project",
  "format_file",
  "index_project",
  "write_docs",
  "build_project",
  "check_project",
].join("|");

/**
 * Some providers leak raw tool-call scaffolding into the text channel instead of
 * the tool channel. Never show that to the user.
 */
const TOOL_NOISE = [
  /<tool_call>[\s\S]*?<\/tool_call>/g,
  /<tool_response>[\s\S]*?<\/tool_response>/g,
  /<\|tool_calls?_(?:begin|section_begin)\|>[\s\S]*?<\|tool_calls?_(?:end|section_end)\|>/g,
  /<\|(?:python_tag|tool▁calls▁begin|tool▁calls▁end|tool▁call▁begin|tool▁sep)\|>/g,
  /<function=[^>]*>[\s\S]*?<\/function>/g,
  new RegExp(
    `^\\s*\\{"(?:name|tool_name|function)"\\s*:\\s*"(?:${TOOL_NAMES})"[\\s\\S]*?\\}\\s*$`,
    "gm",
  ),
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

  let n = 0;
  for (const m of raw.matchAll(new RegExp(MARKER))) {
    const meta = LABELS[m[1]];
    if (!meta) continue;
    steps.push({
      id: `mk-${n++}`,
      kind: meta.kind,
      label: meta.label,
      detail: m[2]?.trim() || undefined,
      state: "done",
    });
  }

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
