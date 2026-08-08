export default function manifest() {
  return {
    name: "Scarsi League",
    short_name: "Scarsi League",
    description: "Statistiche, carte giocatore e classifiche della tua lega di calcetto.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B1210",
    theme_color: "#0B1210",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
