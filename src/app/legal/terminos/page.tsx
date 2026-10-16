import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getSiteContent } from "@/server/content/content";

export const metadata: Metadata = { title: "Términos de uso" };

export default async function TermsPage() {
  const content = await getSiteContent();
  return <LegalPage title="Términos de uso" text={content["legal.terms"]} />;
}
