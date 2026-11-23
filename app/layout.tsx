import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "운동될까",
  description: "공강에 원하는 만큼 운동할 수 있는지 알려 주는 앱",
};

// Design Ref: §3 — 모든 화면이 같은 제목과 이동 메뉴를 공유하는 공통 틀
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="mx-auto w-full max-w-2xl px-4 pt-6">
          <Link href="/" className="text-xl font-bold">
            운동될까
          </Link>
          <NavBar />
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
