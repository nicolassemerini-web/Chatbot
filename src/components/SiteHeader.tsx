import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
      <nav
        aria-label="Principal"
        className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4"
      >
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Compañía <span className="text-accent">IA</span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <Link
            href="/personajes"
            className="flex min-h-11 items-center rounded-full px-3 hover:bg-surface"
          >
            Personajes
          </Link>
          <Link
            href="/cuenta"
            className="flex min-h-11 items-center rounded-full px-3 hover:bg-surface"
          >
            Cuenta
          </Link>
        </div>
      </nav>
    </header>
  );
}
