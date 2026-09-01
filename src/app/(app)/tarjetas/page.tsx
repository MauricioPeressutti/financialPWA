import { requireTeam } from "@/lib/auth";
import { listStatements } from "@/lib/card-statements";
import { StatementCard } from "@/components/tarjetas/statement-card";

export const dynamic = "force-dynamic";

export default async function TarjetasPage() {
  const { team } = await requireTeam();
  const statements = await listStatements(team.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Tarjetas</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Mandale el PDF del resumen al bot de Telegram y aparece acá.
        </p>
      </div>

      {statements.length === 0 ? (
        <div className="cosmic-panel rounded-2xl border p-6 text-center">
          <p className="text-3xl">💳</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Todavía no cargaste ningún resumen. Abrí Telegram, buscá{" "}
            <b className="text-foreground">@Finan_app_bot</b> y mandale el PDF del
            resumen de tu tarjeta. Te aviso cuándo vence y te dejo cargar los
            consumos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {statements.map((s) => (
            <StatementCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );
}
