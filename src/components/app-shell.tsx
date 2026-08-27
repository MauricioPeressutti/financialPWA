"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Home,
  ArrowLeftRight,
  ChartColumn,
  Tags,
  Users,
  LogOut,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
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
  {
    href: "/movimientos",
    label: "Movimientos",
    icon: ArrowLeftRight,
    match: ["/movimientos", "/expenses", "/incomes"],
  },
  { href: "/analytics", label: "Análisis", icon: ChartColumn },
  { href: "/", label: "Inicio", icon: Home },
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
      <header className="cosmic-panel sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div>
          <p className="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
            Equipo
          </p>
          <p className="font-medium text-glow">{team.name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm">
                {user.name?.split(" ")[0] ?? "Cuenta"}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-56">
            <div className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">
              {user.email}
            </div>
            {teams.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    Cambiar de equipo
                  </DropdownMenuLabel>
                  {teams.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => handleSwitch(t.id)}
                    >
                      {t.id === team.id && <Check className="size-4" />}
                      <span className={cn(t.id !== team.id && "ml-6")}>
                        {t.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <nav className="cosmic-panel fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-lg justify-around border-t pb-[env(safe-area-inset-bottom)]">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : (match ?? [href]).some((p) => pathname.startsWith(p));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1.5 py-3.5 text-[0.7rem] transition-colors duration-300",
                active
                  ? "text-primary [&_svg]:drop-shadow-[0_0_8px_rgba(111,255,233,0.55)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute -top-px left-1/2 h-px w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#6fffe9] to-transparent" />
              )}
              <Icon className="size-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
