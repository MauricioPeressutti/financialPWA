"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  LogOut,
  MoreVertical,
  Pencil,
  Send,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  createInviteLink,
  leaveTeam,
  removeMember,
  renameTeam,
  revokeInvitation,
  setEffortEnabled,
  setGoalsEnabled,
  updateTeamCurrencies,
} from "@/lib/actions/team";
import { WhoInvites } from "@/components/games/who-invites";
import { linkTelegram, unlinkTelegram } from "@/lib/actions/telegram";
import {
  CURRENCIES,
  currencyMeta,
  FX_REFERENCES,
  fxReferenceLabel,
  type Currency,
} from "@/lib/currencies";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/utils";

type Member = {
  userId: string;
  name: string | null;
  email: string;
  photoUrl: string | null;
  role: "owner" | "member";
  telegramLinked: boolean;
};
type Invite = { id: string; token: string; expiresAt: string };

const AVATAR_BG = [
  "#3987e5",
  "#d55181",
  "#199e70",
  "#c98500",
  "#9085e9",
  "#d95926",
];
const avatarColor = (id: string) =>
  AVATAR_BG[
    [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0) % AVATAR_BG.length
  ];

function daysLeft(iso: string) {
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d <= 0 ? "vencida" : d === 1 ? "vence mañana" : `vence en ${d} días`;
}

type CurrencySettings = {
  primary: string;
  active: string[];
  reference: string;
  usdArsRate: number | null;
};

export function TeamManager({
  isOwner,
  currentUserId,
  team,
  members,
  invites,
  telegramLinked,
  currency,
  effortEnabled,
  goalsEnabled,
}: {
  isOwner: boolean;
  currentUserId: string;
  team: { name: string };
  members: Member[];
  invites: Invite[];
  telegramLinked: boolean;
  currency: CurrencySettings;
  effortEnabled: boolean;
  goalsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);

  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [tgUrl, setTgUrl] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteFullUrl = (token: string) =>
    inviteUrl && inviteUrl.includes(token)
      ? inviteUrl
      : `${baseUrl}/join/${token}`;

  function copy(text: string, label = "Enlace copiado") {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(label),
      () => toast.error("No se pudo copiar"),
    );
  }

  function saveName() {
    const trimmed = name.trim();
    setEditing(false);
    if (!trimmed || trimmed === team.name) {
      setName(team.name);
      return;
    }
    startTransition(async () => {
      const r = await renameTeam(trimmed);
      if (!r.ok) {
        toast.error(r.error);
        setName(team.name);
        return;
      }
      toast.success("Nombre actualizado");
      router.refresh();
    });
  }

  function generateInvite() {
    startTransition(async () => {
      const r = await createInviteLink();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const url = r.url.startsWith("http") ? r.url : `${baseUrl}${r.url}`;
      setInviteUrl(url);
      copy(url);
      router.refresh();
    });
  }

  function connectTelegram() {
    startTransition(async () => {
      const r = await linkTelegram();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setTgUrl(r.url);
      copy(r.url, "Enlace de Telegram copiado");
    });
  }

  const memberCount = members.length;

  return (
    <div className="space-y-4">
      {/* ── Identidad del equipo ── */}
      <section className="cosmic-panel flex items-center gap-3 rounded-2xl border p-4">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-border bg-gradient-to-br from-[#6fffe9]/40 to-[#5bc0be]/25 text-xl">
          🪐
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={name}
              autoFocus
              className="h-8 max-w-[240px] text-base font-semibold"
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setName(team.name);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-semibold">{team.name}</p>
              {isOwner && (
                <button
                  type="button"
                  aria-label="Cambiar nombre"
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {memberCount} {memberCount === 1 ? "persona" : "personas"} ·{" "}
            {isOwner ? "sos el owner" : "sos miembro"}
          </p>
        </div>
      </section>

      {/* ── Miembros ── */}
      <section className="cosmic-panel rounded-2xl border p-4">
        <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Miembros
        </p>
        <div className="divide-y">
          {members.map((m) => {
            const isSelf = m.userId === currentUserId;
            const canManage = isOwner && m.role !== "owner" && !isSelf;
            return (
              <div key={m.userId} className="flex items-center gap-3 py-2.5">
                {m.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.photoUrl}
                    alt=""
                    className="size-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                    style={{ background: avatarColor(m.userId) }}
                  >
                    {(m.name ?? m.email)[0]?.toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{m.name ?? m.email}</span>
                    {isSelf && <Tag tone="accent">Vos</Tag>}
                    <Tag tone={m.role === "owner" ? "glow" : "muted"}>
                      {m.role === "owner" ? "Owner" : "Miembro"}
                    </Tag>
                    {m.telegramLinked && (
                      <Tag tone="tg">
                        <Send className="size-2.5" /> Telegram
                      </Tag>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Opciones">
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setConfirmRemove(m)}
                      >
                        Quitar del equipo
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Invitar (owner) ── */}
      {isOwner && (
        <section className="cosmic-panel rounded-2xl border p-4">
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Invitar a alguien
          </p>
          <p className="mb-3 text-sm text-muted-foreground">
            Generá un enlace y pasáselo a quien quieras sumar. Entra con su Google
            y queda en el equipo. Vence a los 14 días.
          </p>
          <Button className="w-full" disabled={pending} onClick={generateInvite}>
            <UserPlus className="size-4" />
            {inviteUrl ? "Crear otro enlace" : "Crear enlace de invitación"}
          </Button>

          {inviteUrl && (
            <div className="mt-3 space-y-2 rounded-xl border border-dashed p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Enlace listo — compartilo:
              </p>
              <LinkRow url={inviteUrl} onCopy={() => copy(inviteUrl)} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-[#25d366] text-[#04240f] hover:bg-[#25d366]/90"
                  render={
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Te sumo a nuestro equipo de gastos: ${inviteUrl}`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setInviteUrl(null)}
                >
                  Listo
                </Button>
              </div>
            </div>
          )}

          {invites.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Invitaciones activas
              </p>
              {invites.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center gap-2.5 rounded-xl border bg-muted/40 px-3 py-2"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px] shadow-primary/20" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">Enlace abierto</p>
                    <p className="text-xs text-muted-foreground">
                      {daysLeft(i.expiresAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => copy(inviteFullUrl(i.token))}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await revokeInvitation(i.id);
                        toast.success("Invitación revocada");
                        router.refresh();
                      })
                    }
                  >
                    Revocar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Telegram ── */}
      <section className="cosmic-panel rounded-2xl border p-4">
        <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
          Cargar por Telegram
        </p>
        <p className="mb-3 text-sm text-muted-foreground">
          Conectá tu Telegram y cargá gastos e ingresos escribiéndole al bot, sin
          abrir la app.
        </p>

        {telegramLinked ? (
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#2aabee] text-base">
              ✈️
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Conectado</p>
              <p className="truncate text-xs text-muted-foreground">
                @Finan_app_bot · vinculado a tu cuenta
              </p>
            </div>
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await unlinkTelegram();
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  setTgUrl(null);
                  toast.success("Telegram desconectado");
                  router.refresh();
                })
              }
            >
              Desconectar
            </Button>
          </div>
        ) : (
          <>
            <Button className="w-full" disabled={pending} onClick={connectTelegram}>
              <Send className="size-4" />
              {tgUrl ? "Generar otro enlace" : "Conectar Telegram"}
            </Button>
            {tgUrl && (
              <div className="mt-3 space-y-2.5 rounded-xl border border-dashed p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Abrí este enlace en tu teléfono y tocá <b>Iniciar</b>:
                </p>
                <LinkRow url={tgUrl} onCopy={() => copy(tgUrl, "Enlace copiado")} />
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  <Step n={1}>Se abre el chat con el bot</Step>
                  <Step n={2}>
                    Tocá <b>Iniciar</b> / <b>Start</b>
                  </Step>
                  <Step n={3}>Te responde &ldquo;Cuenta vinculada&rdquo; y listo</Step>
                </ol>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── ¿Quién invita hoy? ── */}
      <WhoInvites
        players={members.map((m) => ({
          id: m.userId,
          name: (m.name ?? m.email).split(" ")[0],
        }))}
      />

      {/* ── Calculadora de esfuerzo ── */}
      <EffortSection isOwner={isOwner} enabled={effortEnabled} />

      {/* ── Objetivos ── */}
      <GoalsSection isOwner={isOwner} enabled={goalsEnabled} />

      {/* ── Monedas ── */}
      <CurrencySection isOwner={isOwner} settings={currency} />

      {/* ── Salir (miembro) ── */}
      {!isOwner && (
        <div className="text-center">
          <button
            type="button"
            className="p-2 text-sm font-medium text-destructive"
            onClick={() => setConfirmLeave(true)}
          >
            <LogOut className="mr-1.5 inline size-4 align-[-3px]" />
            Salir del equipo
          </button>
        </div>
      )}

      {/* ── Diálogos ── */}
      <Dialog
        open={!!confirmRemove}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              ¿Quitar a {confirmRemove?.name ?? confirmRemove?.email}?
            </DialogTitle>
            <DialogDescription>
              Deja de ver los movimientos del equipo. Sus gastos ya cargados
              quedan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancelar</Button>} />
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const m = confirmRemove;
                if (!m) return;
                startTransition(async () => {
                  const r = await removeMember(m.userId);
                  setConfirmRemove(null);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success(`${m.name ?? m.email} salió del equipo`);
                  router.refresh();
                });
              }}
            >
              Quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Salir de {team.name}?</DialogTitle>
            <DialogDescription>
              Vas a dejar de ver los movimientos del equipo. Podés volver a
              entrar si te pasan un enlace nuevo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancelar</Button>} />
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await leaveTeam();
                  setConfirmLeave(false);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  router.push("/");
                  router.refresh();
                })
              }
            >
              Salir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EffortSection({
  isOwner,
  enabled,
}: {
  isOwner: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const r = await setEffortEnabled(!enabled);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(!enabled ? "Activada" : "Desactivada");
      router.refresh();
    });
  }

  return (
    <section className="cosmic-panel rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Calculadora de esfuerzo</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Reparte los gastos compartidos <b>según lo que gana cada uno</b>, no
            por mitades. Cada persona carga su ingreso mensual y, al cargar un
            gasto, un switch permite marcarlo como compartido y elegir quién
            pagó. La app lleva el saldo (&ldquo;X le debe a Y&rdquo;) hasta que
            lo saldan.
          </p>
          {isOwner && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Si la activás, aparece <b>Esfuerzo</b> en la barra de abajo.
            </p>
          )}
        </div>
        {isOwner ? (
          <button
            type="button"
            aria-pressed={enabled}
            disabled={pending}
            onClick={toggle}
            className={cn(
              "relative h-[24px] w-11 shrink-0 rounded-full transition-colors",
              enabled ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
                enabled && "translate-x-[18px]",
              )}
            />
          </button>
        ) : (
          <Tag tone={enabled ? "accent" : "muted"}>
            {enabled ? "Activa" : "Off"}
          </Tag>
        )}
      </div>
    </section>
  );
}

function GoalsSection({
  isOwner,
  enabled,
}: {
  isOwner: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const r = await setGoalsEnabled(!enabled);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(!enabled ? "Activados" : "Desactivados");
      router.refresh();
    });
  }

  return (
    <section className="cosmic-panel rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Objetivos</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Metas de ahorro para algo puntual (un viaje, un cambio de auto).
            Se crea un objetivo con un monto y cada tanto se cargan aportes. La
            app muestra el progreso y a qué ritmo vas. Los aportes son solo un
            registro del objetivo: no tocan tus gastos ni el balance del equipo.
          </p>
          {isOwner && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Si los activás, aparece <b>Objetivos</b> en la barra de abajo.
            </p>
          )}
        </div>
        {isOwner ? (
          <button
            type="button"
            aria-pressed={enabled}
            disabled={pending}
            onClick={toggle}
            className={cn(
              "relative h-[24px] w-11 shrink-0 rounded-full transition-colors",
              enabled ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
                enabled && "translate-x-[18px]",
              )}
            />
          </button>
        ) : (
          <Tag tone={enabled ? "accent" : "muted"}>
            {enabled ? "Activos" : "Off"}
          </Tag>
        )}
      </div>
    </section>
  );
}

function CurrencySection({
  isOwner,
  settings,
}: {
  isOwner: boolean;
  settings: CurrencySettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [primary, setPrimary] = useState(settings.primary);
  const [active, setActive] = useState<string[]>(settings.active);
  const [reference, setReference] = useState(settings.reference);

  const dirty =
    primary !== settings.primary ||
    reference !== settings.reference ||
    active.slice().sort().join() !== settings.active.slice().sort().join();

  function toggle(c: string) {
    if (c === primary) return;
    setActive((a) => (a.includes(c) ? a.filter((x) => x !== c) : [...a, c]));
  }

  function save() {
    startTransition(async () => {
      const r = await updateTeamCurrencies({
        primaryCurrency: primary,
        currencies: Array.from(new Set([primary, ...active])),
        fxReference: reference,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Monedas actualizadas");
      router.refresh();
    });
  }

  const foreignActive = active.filter((c) => c !== primary);

  return (
    <section className="cosmic-panel rounded-2xl border p-4">
      <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
        Monedas
      </p>

      {isOwner ? (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Moneda principal</p>
              <p className="text-xs text-muted-foreground">
                En la que se muestran los totales.
              </p>
            </div>
            <select
              className="rounded-lg border bg-[var(--field-surface)] px-2.5 py-1.5 text-sm font-semibold"
              value={primary}
              onChange={(e) => {
                setPrimary(e.target.value);
                setActive((a) =>
                  a.includes(e.target.value) ? a : [...a, e.target.value],
                );
              }}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {currencyMeta[c].label} ({currencyMeta[c].symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm font-medium">Monedas que usamos</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Aparecen en el selector al cargar un movimiento.
            </p>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => {
                const on = c === primary || active.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={c === primary}
                    aria-pressed={on}
                    onClick={() => toggle(c)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                      on
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground",
                      c === primary && "opacity-60",
                    )}
                  >
                    {currencyMeta[c].symbol} {c}
                    {c === primary ? " · principal" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {foreignActive.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Referencia del dólar</p>
                <p className="text-xs text-muted-foreground">
                  Qué cotización usar para convertir.
                </p>
              </div>
              <select
                className="rounded-lg border bg-[var(--field-surface)] px-2.5 py-1.5 text-sm font-semibold"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              >
                {FX_REFERENCES.map((r) => (
                  <option key={r} value={r}>
                    {fxReferenceLabel[r]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {settings.usdArsRate && (
            <p className="text-xs text-muted-foreground">
              Cotización de hoy: 1 US$ ={" "}
              {formatCents(Math.round(settings.usdArsRate * 100))} ·{" "}
              {fxReferenceLabel[settings.reference as keyof typeof fxReferenceLabel] ??
                settings.reference}
            </p>
          )}

          {dirty && (
            <Button className="w-full" disabled={pending} onClick={save}>
              Guardar
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Principal: <b className="text-foreground">
            {currencyMeta[settings.primary as Currency]?.label ?? settings.primary}
          </b>
          {settings.active.length > 1 && (
            <> · también {settings.active.filter((c) => c !== settings.primary).join(", ")}</>
          )}
        </p>
      )}
    </section>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "accent" | "glow" | "muted" | "tg";
}) {
  const cls = {
    accent: "bg-primary/15 text-primary",
    glow: "bg-[#6fffe9]/20 text-foreground/80",
    muted: "bg-muted text-muted-foreground",
    tg: "bg-[#2aabee]/15 text-[#2aabee]",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide",
        cls,
      )}
    >
      {children}
    </span>
  );
}

function LinkRow({ url, onCopy }: { url: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background/60 py-1.5 pl-2.5 pr-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
        {url}
      </code>
      <Button variant="ghost" size="xs" onClick={onCopy}>
        <Copy className="size-3.5" />
      </Button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-px grid size-[18px] shrink-0 place-items-center rounded-full bg-primary/15 text-[0.62rem] font-bold text-primary">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}
