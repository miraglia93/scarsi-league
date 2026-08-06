import "./globals.css";

export const metadata = {
  title: "Scarsi League — Calci8Lunedì",
  description: "La lega dove siamo tutti scarsi, ma qualcuno lo è meno",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
