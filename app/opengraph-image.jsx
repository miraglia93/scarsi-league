import { ImageResponse } from "next/og";

export const alt = "Scarsi League — Calci8Lunedì";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B1210",
          backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(72,120,86,0.35), transparent)",
        }}
      >
        <div style={{ display: "flex", fontSize: 120, fontWeight: 700, letterSpacing: -2 }}>
          <span style={{ color: "#E8EDE6" }}>SCARSI</span>
          <span style={{ width: 32 }} />
          <span style={{ color: "#E3C567" }}>LEAGUE</span>
        </div>
        <div style={{ marginTop: 28, fontSize: 34, color: "#8FA096", letterSpacing: 6, textTransform: "uppercase" }}>
          Calci8Lunedì
        </div>
      </div>
    ),
    { ...size }
  );
}
