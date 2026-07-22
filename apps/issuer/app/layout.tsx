import { neoGlobalCss } from "@attestant/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Attestant Issuer Console",
  description:
    "Create your organisation and issue XP and reputation credentials.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: neoGlobalCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
