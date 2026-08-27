"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/lib/actions/team";

export function JoinButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function join() {
    startTransition(async () => {
      const res = await acceptInvitation(token);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("¡Listo, ya sos parte del equipo!");
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <Button onClick={join} disabled={pending} className="w-full">
      {pending ? "Uniéndote…" : "Unirme al equipo"}
    </Button>
  );
}
