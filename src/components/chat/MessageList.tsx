import { Copy } from "lucide-react";
import { toast } from "sonner";
import { parseThinking, splitAttachments } from "@/lib/parse-thinking";
import { deriveSteps, stripMarkers } from "@/lib/agent-steps";
import { Markdown } from "./Markdown";
import { ThinkingPanel } from "./ThinkingPanel";
import { AgentActivity, AgentBooting } from "./AgentActivity";

export type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

function UserBubble({ content }: { content: string }) {
  const { text, images } = splitAttachments(content);
  return (
    <div className="flex justify-end">
      <div className="max-w-[86%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-6 text-primary-foreground">
        {text && <div className="whitespace-pre-wrap">{text}</div>}
        {images.length > 0 && (
          <div className={`${text ? "mt-2" : ""} flex flex-wrap gap-2`}>
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt="attachment"
                className="max-h-36 rounded-lg border border-black/10"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  const { thinking, visible, isThinking } = parseThinking(content);
  const steps = deriveSteps(content, !!streaming);
  const body = stripMarkers(visible);
  return (
    <div className="space-y-2.5">
      {(thinking || (streaming && isThinking)) && (
        <ThinkingPanel text={thinking} live={!!streaming && isThinking} />
      )}
      {steps.length > 0 && <AgentActivity steps={steps} />}
      {body && (
        <div>
          <Markdown text={body} streaming={streaming} />
          {!streaming && (
            <button
              onClick={() => {
                navigator.clipboard?.writeText(body).catch(() => {});
                toast.success("Copied");
              }}
              aria-label="Copy answer"
              className="tap tap-press mt-1 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-[oklch(1_0_0_/_0.06)]"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {streaming && !body && !isThinking && !steps.length && <AgentBooting />}
    </div>
  );
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="space-y-5">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} content={m.content} />
        ) : (
          <AssistantMessage key={m.id} content={m.content} streaming={m.id === "__stream__"} />
        ),
      )}
    </div>
  );
}
