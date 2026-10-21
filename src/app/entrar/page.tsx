import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          Necesitas una cuenta para guardar tus conversaciones. Solo para mayores de 18 años.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </main>
    </>
  );
}
