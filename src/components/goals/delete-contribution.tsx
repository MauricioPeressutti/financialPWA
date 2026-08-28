"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteContribution } from "@/lib/actions/goals";

export function DeleteContribution({
  id,
  goalId,
}: {
  id: string;
  goalId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Borrar aporte"
      disabled={pending}
      className="text-muted-foreground hover:text-destructive"
      onClick={() =>
        startTransition(async () => {
          const r = await deleteContribution(id, goalId);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          toast.success("Aporte borrado");
          router.refresh();
        })
      }
    >
      <X className="size-3.5" />
    </Button>
  );
}
