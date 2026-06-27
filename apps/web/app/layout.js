import "./globals.css";
import "./styles.css";

export const metadata = {
  title: "AI Bus Booking",
  description: "Intercity bus booking demo"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
