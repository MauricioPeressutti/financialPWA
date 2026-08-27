"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";

export function MonthPicker({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(next: string) {
    const sp = new URLSearchParams(params);
    if (next) sp.set("month", next);
    else sp.delete("month");
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <Input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-40"
    />
  );
}
