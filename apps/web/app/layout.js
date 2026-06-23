import "./globals.css";

export const metadata = {
  title: "Intercity Bus Booking AI - Admin Portal",
  description: "Admin portal for managing intercity bus routes, stops, vehicles, seat layouts, and trips.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
