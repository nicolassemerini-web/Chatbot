import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getSiteContent } from "@/server/content/content";

export const metadata: Metadata = { title: "Política de privacidad" };

export default async function PrivacyPage() {
  const content = await getSiteContent();
  return <LegalPage title="Política de privacidad" text={content["legal.privacy"]} />;
}
