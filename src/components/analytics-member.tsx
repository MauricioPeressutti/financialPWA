"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

type Member = { userId: string; name: string };

export function AnalyticsMember({
  members,
  value,
}: {
  members: Member[];
  value?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(id?: string) {
    const sp = new URLSearchParams(params);
    if (id) sp.set("member", id);
    else sp.delete("member");
    router.push(`${pathname}?${sp.toString()}`);
  }

  const options = [{ userId: "", name: "Todos" }, ...members];

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border p-1 text-xs">
      {options.map((o) => {
        const active = (o.userId || undefined) === (value || undefined);
        return (
          <button
            key={o.userId || "all"}
            onClick={() => set(o.userId || undefined)}
            aria-pressed={active}
            className={cn(
              "rounded-md px-2.5 py-1.5 transition-colors",
              active
                ? "bg-primary/20 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
