import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ModelSheet } from "@/components/ModelSheet";
import { DEFAULT_MODEL_ID } from "@/lib/models";

export const Route = createFileRoute("/dev-models")({ component: Dev });

function Dev() {
  const [id, setId] = useState(DEFAULT_MODEL_ID);
  return (
    <div className="min-h-screen bg-background p-4">
      <ModelSheet open onClose={() => {}} value={id} onChange={setId} />
    </div>
  );
}
