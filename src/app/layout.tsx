import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Compañía IA",
    template: "%s · Compañía IA",
  },
  description:
    "Conversa con personajes ficticios impulsados por inteligencia artificial. Solo para mayores de 18 años.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0d0c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-dvh flex-col font-sans">{children}</body>
    </html>
  );
}
