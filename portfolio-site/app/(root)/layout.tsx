import type { Metadata } from "next";
import { inter, manrope } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Evgeniy · Full-Stack Web Developer",
  description: "Portfolio of Evgeniy, Full-Stack Web Developer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
