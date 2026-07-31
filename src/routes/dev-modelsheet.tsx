import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ModelSheet } from "@/components/ModelSheet";
import { DEFAULT_MODEL_ID, type CodexModelId } from "@/lib/models";

export const Route = createFileRoute("/dev-modelsheet")({ component: Page });

function Page() {
  const [v, setV] = useState<CodexModelId>(DEFAULT_MODEL_ID);
  return <ModelSheet open onClose={() => {}} value={v} onChange={setV} />;
}
