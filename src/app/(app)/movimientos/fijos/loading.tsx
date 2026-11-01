export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded-md bg-muted" />
        <div className="h-10 w-20 rounded-lg bg-muted" />
      </div>
      <div className="h-9 rounded-lg bg-muted" />
      <div className="mx-auto h-10 w-48 rounded-lg bg-muted" />
      <div className="h-9 rounded-lg bg-muted" />
      <div className="divide-y">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 py-3">
            <div className="flex items-center gap-3">
              <div className="size-7 rounded-md bg-muted" />
              <div className="h-4 flex-1 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
            <div className="ml-9 h-10 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
