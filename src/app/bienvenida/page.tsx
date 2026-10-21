import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { safeNextPath } from "@/lib/safe-redirect";
import { getProfile, isOnboarded, requireUser } from "@/server/auth/session";
import { WelcomeForm } from "./WelcomeForm";

export const metadata: Metadata = { title: "Bienvenida" };

async function Welcome({ searchParams }: Pick<PageProps<"/bienvenida">, "searchParams">) {
  const next = safeNextPath((await searchParams).next);
  const user = await requireUser(`/bienvenida?next=${encodeURIComponent(next)}`);
  const profile = await getProfile(user.id);
  if (isOnboarded(profile)) redirect(next);

  return <WelcomeForm next={next} defaultName={profile?.displayName ?? ""} />;
}

export default function WelcomePage({ searchParams }: PageProps<"/bienvenida">) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Te damos la bienvenida</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Antes de empezar, un par de cosas.</p>
        <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
          <Welcome searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
