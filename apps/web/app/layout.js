import { Be_Vietnam_Pro } from "next/font/google";

import "./tokens.css";
import "./globals.css";
import "./styles.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap"
});

export const metadata = {
  title: "AI Bus Booking",
  description: "Intercity bus booking demo"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body suppressHydrationWarning>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
