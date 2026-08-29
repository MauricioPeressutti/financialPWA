import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinButton } from "@/components/join-button";
import { getCurrentUser } from "@/lib/auth";
import { getInvitationPreview } from "@/lib/queries";

export default async function JoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  const preview = await getInvitationPreview(token);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Invitación</CardTitle>
          <CardDescription>
            {preview?.valid ? (
              <>
                {preview.invitedBy ? `${preview.invitedBy} te suma` : "Te sumaron"}{" "}
                al equipo <b className="text-foreground">{preview.teamName}</b>
              </>
            ) : (
              "Esta invitación no es válida o ya venció"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {preview?.valid ? (
            <>
              <JoinButton token={token} />
              <p className="text-center text-xs text-muted-foreground">
                Vas a compartir gastos e ingresos con {preview.teamName}. Tu
                cuenta puede estar en varios equipos.
              </p>
            </>
          ) : (
            <Button variant="outline" render={<Link href="/">Ir al inicio</Link>} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
