import type { Metadata } from "next";

import minclassLogo from "../../picture/logo.png";
import { AnonymousAuthBootstrap } from "@/components/anonymous-auth-bootstrap";

import "./globals.css";

export const metadata: Metadata = {
  title: "MINCLASS",
  description: "Classroom companion cho lớp học trực tiếp.",
  icons: {
    icon: minclassLogo.src,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <AnonymousAuthBootstrap>{children}</AnonymousAuthBootstrap>
      </body>
    </html>
  );
}
