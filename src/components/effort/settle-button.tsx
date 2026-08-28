"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { settleUp } from "@/lib/actions/effort";

export function SettleButton({
  currency,
  label,
}: {
  currency: string;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Saldar cuentas
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Saldar cuentas?</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Nota (opcional)</label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: transferencia del 5"
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancelar</Button>} />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await settleUp({ currency, note });
                setOpen(false);
                if (!r.ok) {
                  toast.error(r.error);
                  return;
                }
                toast.success("Cuentas saldadas");
                router.refresh();
              })
            }
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
