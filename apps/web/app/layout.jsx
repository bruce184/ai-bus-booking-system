import "./globals.css";

export const metadata = {
  title: "Intercity Bus Booking AI",
  description: "Demo search and booking chatbot for intercity bus trips"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
