import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://scarsileague.it"),
  title: "Scarsi League — Calci8Lunedì",
  description: "Statistiche, carte giocatore e classifiche della lega di calcetto Calci8Lunedì — dati importati da Fubles.",
  openGraph: {
    title: "Scarsi League — Calci8Lunedì",
    description: "Statistiche, carte giocatore e classifiche della lega di calcetto Calci8Lunedì.",
    url: "https://scarsileague.it",
    siteName: "Scarsi League",
    locale: "it_IT",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scarsi League",
  },
};

export const viewport = {
  themeColor: "#0B1210",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
