import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <span style={{ color: "#E3C567", fontSize: 22, fontWeight: 700 }}>S</span>
      </div>
    ),
    { ...size }
  );
}
