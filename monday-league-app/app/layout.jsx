import "./globals.css";

export const metadata = {
  title: "Monday League — Calciotto del Lunedì",
  description: "Statistiche, carte e classifiche della lega del lunedì",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
