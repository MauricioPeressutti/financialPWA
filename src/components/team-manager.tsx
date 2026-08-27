"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createInviteLink,
  removeMember,
  renameTeam,
  revokeInvitation,
} from "@/lib/actions/team";
import { linkTelegram, unlinkTelegram } from "@/lib/actions/telegram";

type Member = {
  userId: string;
  name: string | null;
  email: string;
  role: "owner" | "member";
};
type Invite = { id: string; token: string; expiresAt: string };

export function TeamManager({
  isOwner,
  currentUserId,
  team,
  members,
  invites,
  telegramLinked,
}: {
  isOwner: boolean;
  currentUserId: string;
  team: { name: string };
  members: Member[];
  invites: Invite[];
  telegramLinked: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(team.name);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [tgLink, setTgLink] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Link copiado"),
      () => toast.error("No se pudo copiar"),
    );
  }

  function generate() {
    startTransition(async () => {
      const res = await createInviteLink();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const url = res.url.startsWith("http") ? res.url : `${baseUrl}${res.url}`;
      setLastLink(url);
      copy(url);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <section className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Nombre del equipo</p>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              variant="outline"
              disabled={pending || !name.trim() || name === team.name}
              onClick={() =>
                startTransition(async () => {
                  const r = await renameTeam(name);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success("Guardado");
                  router.refresh();
                })
              }
            >
              Guardar
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Cargar gastos por Telegram
        </p>
        {telegramLinked ? (
          <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span className="flex items-center gap-2">
              <Send className="size-4 text-primary" />
              Vinculado
            </span>
            <Button
              variant="ghost"
              size="xs"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await unlinkTelegram();
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setTgLink(null);
                  toast.success("Telegram desvinculado");
                  router.refresh();
                })
              }
            >
              Desvincular
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Vinculá tu Telegram y cargá gastos escribiéndole al bot en lenguaje
              normal (ej: <i>&ldquo;5300 chino con débito&rdquo;</i>).
            </p>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await linkTelegram();
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setTgLink(r.url);
                })
              }
            >
              <Send className="size-4" />
              Generar link de Telegram
            </Button>
            {tgLink && (
              <div className="space-y-2 rounded-lg border p-3 text-xs">
                <p className="text-muted-foreground">
                  Abrí este link en tu teléfono y tocá <b>Start</b>:
                </p>
                <div className="flex items-center gap-2">
                  <a
                    href={tgLink}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-primary underline"
                  >
                    {tgLink}
                  </a>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => copy(tgLink)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Miembros</p>
        <div className="divide-y">
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{m.name ?? m.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                  {m.role === "owner" ? "Owner" : "Miembro"}
                </Badge>
                {isOwner && m.role !== "owner" && m.userId !== currentUserId && (
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await removeMember(m.userId);
                        router.refresh();
                      })
                    }
                  >
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {isOwner && (
        <section className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Invitar</p>
          <Button onClick={generate} disabled={pending}>
            Generar link de invitación
          </Button>

          {lastLink && (
            <div className="flex items-center gap-2 rounded-lg border p-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{lastLink}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => copy(lastLink)}>
                <Copy className="size-4" />
              </Button>
            </div>
          )}

          {invites.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Invitaciones activas</p>
              {invites.map((i) => {
                const url = `${baseUrl}/join/${i.token}`;
                return (
                  <div
                    key={i.id}
                    className="flex items-center gap-2 border-b py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate">{url}</span>
                    <Button variant="ghost" size="icon-sm" onClick={() => copy(url)}>
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await revokeInvitation(i.id);
                          router.refresh();
                        })
                      }
                    >
                      Revocar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
