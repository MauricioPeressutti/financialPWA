export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Finanzas</h1>
      <p className="text-muted-foreground max-w-md text-sm">
        Gastos compartidos de la familia. Fase 0: scaffold + deploy en Cloud Run.
      </p>
      <p className="text-xs text-neutral-500">
        Próximo: login con Google (Fase 1).
      </p>
    </main>
  );
}
