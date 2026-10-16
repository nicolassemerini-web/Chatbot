"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AiNotice } from "@/components/AiNotice";
import { Avatar } from "@/components/Avatar";
import { MAX_HISTORY_MESSAGES, MAX_MESSAGE_CHARS } from "@/lib/validation/limits";
import type { CharacterSummary } from "@/server/characters/types";

type Message = { id: number; role: "user" | "assistant"; content: string };

type Props = {
  character: CharacterSummary;
  demoMode: boolean;
};

let nextId = 0;

export function ChatWindow({ character, demoMode }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send() {
    const text = draft.trim();
    if (!text || pending || text.length > MAX_MESSAGE_CHARS) return;

    const userMessage: Message = { id: nextId++, role: "user", content: text };
    const assistantId = nextId++;
    const history = [...messages, userMessage];

    setDraft("");
    setError(null);
    setPending(true);
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterSlug: character.slug,
          messages: history
            .slice(-MAX_HISTORY_MESSAGES)
            .map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se ha podido enviar el mensaje.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const piece = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + piece } : m)),
        );
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Error inesperado.");
      // Se quita la burbuja vacía del personaje si no llegó a responder.
      setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content !== ""));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // En escritorio, Intro envía y Mayús+Intro añade una línea.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  const tooLong = draft.length > MAX_MESSAGE_CHARS;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b border-border px-2 py-2">
        <Link
          href="/personajes"
          aria-label="Volver a personajes"
          className="flex size-11 items-center justify-center rounded-full text-xl hover:bg-surface"
        >
          ←
        </Link>
        <Avatar name={character.name} accent={character.accent} size="sm" />
        <div className="min-w-0">
          <h1 className="truncate font-semibold leading-tight">{character.name}</h1>
          <AiNotice short />
        </div>
      </header>

      {demoMode && (
        <p className="border-b border-border bg-surface px-4 py-1.5 text-center text-xs text-muted">
          Modo de prueba: las respuestas son simuladas y no se guardan.
        </p>
      )}

      <div
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label={`Conversación con ${character.name}`}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Avatar name={character.name} accent={character.accent} size="lg" />
            <p className="font-medium">{character.tagline}</p>
            <p className="max-w-sm text-sm text-muted">{character.shortBio}</p>
            <p className="text-sm text-muted">Escribe un mensaje para empezar.</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 ${
                m.role === "user"
                  ? "rounded-br-sm bg-accent text-accent-foreground"
                  : "rounded-bl-sm border border-border bg-surface"
              }`}
            >
              {m.content || <span className="text-muted">escribiendo…</span>}
            </p>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={onSubmit}
        className="flex items-end gap-2 border-t border-border px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <label htmlFor="message" className="sr-only">
          Mensaje para {character.name}
        </label>
        <textarea
          id="message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={`Escribe a ${character.name}…`}
          aria-invalid={tooLong}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={pending || !draft.trim() || tooLong}
          className="flex min-h-11 items-center rounded-full bg-accent px-4 font-semibold text-accent-foreground disabled:opacity-40"
        >
          Enviar
        </button>
      </form>
      {tooLong && (
        <p className="px-4 pb-2 text-xs text-red-600 dark:text-red-400">
          El mensaje supera los {MAX_MESSAGE_CHARS} caracteres.
        </p>
      )}
    </div>
  );
}
