"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Home, ListPlus, Tags, Users, LogOut, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, switchTeam } from "@/lib/actions/team";
import { signOutClient } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type Props = {
  user: { name: string | null; email: string; photoUrl: string | null };
  team: { id: string; name: string; role: "owner" | "member" };
  teams: { id: string; name: string }[];
  children: React.ReactNode;
};

const NAV = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/expenses", label: "Gastos", icon: ListPlus },
  { href: "/categories", label: "Categorías", icon: Tags },
  { href: "/team", label: "Equipo", icon: Users },
];

export function AppShell({ user, team, teams, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handleSignOut() {
    await signOutClient().catch(() => {});
    await signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  function handleSwitch(id: string) {
    startTransition(async () => {
      await switchTeam(id);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Equipo</p>
          <p className="font-medium">{team.name}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm">
                {user.name?.split(" ")[0] ?? "Cuenta"}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
            {teams.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Cambiar de equipo
                </DropdownMenuLabel>
                {teams.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => handleSwitch(t.id)}>
                    {t.id === team.id && <Check className="size-4" />}
                    <span className={cn(t.id !== team.id && "ml-6")}>{t.name}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 px-4 py-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg justify-around border-t bg-background/95 backdrop-blur">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
