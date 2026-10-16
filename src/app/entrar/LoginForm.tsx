"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { sendMagicLink, signInWithPassword, signUp, type AuthFormState } from "./acciones";

type Mode = "password" | "signup" | "link";

const MODES: { id: Mode; label: string }[] = [
  { id: "password", label: "Entrar" },
  { id: "signup", label: "Crear cuenta" },
  { id: "link", label: "Enlace por correo" },
];

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-base outline-none focus:border-accent";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/personajes";
  const linkError = params.get("error") === "enlace";
  const [mode, setMode] = useState<Mode>("password");

  const [passwordState, passwordAction, passwordPending] = useActionState(signInWithPassword, {});
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, {});
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, {});

  const current: Record<Mode, [AuthFormState, (f: FormData) => void, boolean]> = {
    password: [passwordState, passwordAction, passwordPending],
    signup: [signUpState, signUpAction, signUpPending],
    link: [linkState, linkAction, linkPending],
  };
  const [state, action, pending] = current[mode];

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Forma de acceso" className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface p-1 text-sm">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`min-h-10 rounded-full px-2 ${mode === m.id ? "bg-accent font-semibold text-accent-foreground" : "text-muted"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {linkError && !state.error && !state.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          El enlace no es válido o ha caducado. Pide uno nuevo.
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Correo electrónico
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>

        {mode !== "link" && (
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={8}
              maxLength={72}
              required
              className={inputClass}
            />
            {mode === "signup" && <p className="text-xs text-muted">Mínimo 8 caracteres.</p>}
          </div>
        )}

        {mode === "link" && (
          <p className="text-sm text-muted">
            Te enviaremos un enlace para entrar sin contraseña. Si no tienes cuenta, se creará.
          </p>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground disabled:opacity-50"
        >
          {pending ? "Un momento…" : mode === "password" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviarme el enlace"}
        </button>
      </form>
    </div>
  );
}
