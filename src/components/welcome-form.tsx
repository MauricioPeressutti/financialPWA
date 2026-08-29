"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Link2, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFirstTeam, joinFromInput, signOut } from "@/lib/actions/team";

const ASK_MSG =
  "Hola! ¿Me pasás el link para entrar al equipo de gastos en Finanzas? 🙏";

export function WelcomeForm({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function go() {
    router.replace("/");
    router.refresh();
  }

  function create() {
    startTransition(async () => {
      const r = await createFirstTeam(name);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDone(`Equipo «${name.trim() || "Casa"}» creado`);
      go();
    });
  }

  function join() {
    if (!link.trim()) {
      toast.error("Pegá el enlace o el código");
      return;
    }
    startTransition(async () => {
      const r = await joinFromInput(link);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setDone("¡Listo, ya sos parte del equipo!");
      go();
    });
  }

  if (done) {
    return (
      <div className="cosmic-panel rounded-2xl border p-6 text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-xl text-emerald-500">
          ✓
        </div>
        <p className="font-semibold">{done}</p>
        <p className="text-sm text-muted-foreground">Entrando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-lg font-semibold">¡Hola, {firstName}! 👋</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Todavía no estás en ningún equipo. Un equipo es donde vos y quien
          quieras comparten los gastos.
        </p>
      </div>

      {/* Crear */}
      <section className="cosmic-panel rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-gradient-to-br from-[#6fffe9]/20 to-[#5bc0be]/10">
            <Rocket className="size-4 text-primary" />
          </span>
          <div>
            <p className="text-sm font-semibold">Crear un equipo</p>
            <p className="text-xs text-muted-foreground">
              Empezás de cero. Después invitás a quien quieras.
            </p>
          </div>
        </div>
        <label className="mt-3 block text-xs text-muted-foreground">
          ¿Cómo se llama? (opcional)
        </label>
        <Input
          value={name}
          placeholder="Casa"
          maxLength={40}
          className="mt-1"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
        />
        <Button className="mt-3 w-full" disabled={pending} onClick={create}>
          Crear equipo
        </Button>
      </section>

      <div className="relative text-center text-[0.68rem] uppercase tracking-widest text-muted-foreground">
        <span className="bg-background px-3">o</span>
        <span className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" />
      </div>

      {/* Unirse */}
      <section className="cosmic-panel rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-gradient-to-br from-[#6fffe9]/20 to-[#5bc0be]/10">
            <Link2 className="size-4 text-primary" />
          </span>
          <div>
            <p className="text-sm font-semibold">Unirme a uno que ya existe</p>
            <p className="text-xs text-muted-foreground">
              Pegá el enlace que te pasó quien lo creó.
            </p>
          </div>
        </div>
        <label className="mt-3 block text-xs text-muted-foreground">
          Enlace o código de invitación
        </label>
        <Input
          value={link}
          placeholder="…/join/AbC123…"
          className="mt-1"
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={pending}
          onClick={join}
        >
          Unirme
        </Button>
        <button
          type="button"
          className="mt-2.5 text-xs text-primary"
          onClick={() => setShowHelp((v) => !v)}
        >
          {showHelp ? "Ocultar" : "No tengo el enlace →"}
        </button>

        {showHelp && (
          <div className="mt-3 space-y-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            <p>
              Pedíselo a quien creó el equipo. Lo genera en{" "}
              <b className="text-foreground">
                Equipo → Crear enlace de invitación
              </b>{" "}
              y te lo manda.
            </p>
            <p className="rounded-lg border bg-white/5 p-2.5 text-foreground">
              {ASK_MSG}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard?.writeText(ASK_MSG).then(
                    () => toast.success("Copiado"),
                    () => toast.error("No se pudo copiar"),
                  );
                }}
              >
                Copiar mensaje
              </Button>
              <Button
                size="sm"
                className="flex-1 border-0 bg-[#25d366] text-[#04240f] hover:bg-[#25d366]/90"
                render={
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(ASK_MSG)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                }
              />
            </div>
          </div>
        )}
      </section>

      <div className="pt-2 text-center">
        <button
          type="button"
          className="text-xs text-muted-foreground"
          onClick={() => {
            startTransition(async () => {
              await signOut();
              router.replace("/sign-in");
              router.refresh();
            });
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
