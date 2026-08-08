import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B1210",
        }}
      >
        <span style={{ color: "#E3C567", fontSize: 122, fontWeight: 700 }}>S</span>
      </div>
    ),
    { ...size },
  );
}
