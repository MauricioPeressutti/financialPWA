"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, ArchiveRestore, MoreVertical, Pencil, Trash2 } from "lucide-react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteGoal, setGoalArchived } from "@/lib/actions/goals";

export function GoalActions({
  id,
  name,
  archived,
}: {
  id: string;
  name: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function toggleArchive() {
    startTransition(async () => {
      const r = await setGoalArchived(id, !archived);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(!archived ? "Objetivo archivado" : "Objetivo reactivado");
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon-sm" aria-label="Opciones">
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push(`/objetivos/${id}/editar`)}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleArchive} disabled={pending}>
            {archived ? (
              <>
                <ArchiveRestore className="size-4" />
                Reactivar
              </>
            ) : (
              <>
                <Archive className="size-4" />
                Archivar
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar &ldquo;{name}&rdquo;?</DialogTitle>
            <DialogDescription>
              Se borra el objetivo y todos sus aportes. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancelar</Button>} />
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteGoal(id);
                  setConfirmDelete(false);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Objetivo eliminado");
                  router.push("/objetivos");
                  router.refresh();
                })
              }
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
