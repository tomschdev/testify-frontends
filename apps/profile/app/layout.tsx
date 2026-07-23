import { neoGlobalCss, TopBanner } from "@attestant/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Attestant Profile",
  description:
    "View your credentials, sign what needs signing, and browse positions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: neoGlobalCss }} />
      </head>
      <body>
        <TopBanner site="profile" />
        {children}
      </body>
    </html>
  );
}
