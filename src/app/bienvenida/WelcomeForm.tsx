"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completeWelcome } from "./acciones";

export function WelcomeForm({ next, defaultName }: { next: string; defaultName: string }) {
  const [state, action, pending] = useActionState(completeWelcome, {});

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          ¿Cómo quieres que te llamen los personajes?
        </label>
        <input
          id="displayName"
          name="displayName"
          defaultValue={defaultName}
          maxLength={40}
          required
          autoComplete="nickname"
          className="min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent"
        />
        <p className="text-xs text-muted">Puede ser un apodo. No hace falta tu nombre real.</p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="adult" required className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
        <span>Confirmo que tengo 18 años o más.</span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
        <span>
          Acepto los{" "}
          <Link href="/legal/terminos" target="_blank" className="underline">
            términos de uso
          </Link>{" "}
          y la{" "}
          <Link href="/legal/privacidad" target="_blank" className="underline">
            política de privacidad
          </Link>
          , y entiendo que los personajes son ficticios y funcionan con inteligencia artificial.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground disabled:opacity-50"
      >
        {pending ? "Guardando…" : "Empezar"}
      </button>
    </form>
  );
}
