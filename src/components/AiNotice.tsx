/** Aviso permanente de que los personajes son ficticios e impulsados por IA. */
export function AiNotice({ short = false, className = "" }: { short?: boolean; className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      {short
        ? "Personaje ficticio · IA"
        : "Personaje ficticio generado con inteligencia artificial. No es una persona real."}
    </p>
  );
}
