import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kas OSIS EPIS-JH | Buku Kas dan Iuran",
  description: "Catat pembayaran anggota, kelola tagihan, pantau pengeluaran, dan unduh laporan kas OSIS EPIS-JH.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="id"><body>{children}</body></html>;
}
