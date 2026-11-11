import { Nunito_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Aureo",
    template: "Aureo | %s",
  },
  description: "Cobros al día, sin vueltas.",
  icons: {
    icon: "/brand/aureo.ico",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="light">
      <body
        className={`${nunitoSans.variable} ${geistMono.variable} font-sans antialiased min-h-screen bg-crema text-tinta`}
      >
        {children}
      </body>
    </html>
  );
}
