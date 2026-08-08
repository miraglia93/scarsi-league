import { ImageResponse } from "next/og";

export const contentType = "image/png";

const TAGLIE = [
  { id: "32", size: 32 },
  { id: "192", size: 192 },
  { id: "512", size: 512 },
];

export function generateImageMetadata() {
  return TAGLIE.map(({ id, size }) => ({
    id,
    size: { width: size, height: size },
    contentType,
  }));
}

export default function Icon({ id }) {
  const { size } = TAGLIE.find((t) => t.id === id) || TAGLIE[0];
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
          borderRadius: size * 0.19,
        }}
      >
        <span style={{ color: "#E3C567", fontSize: size * 0.68, fontWeight: 700 }}>S</span>
      </div>
    ),
    { width: size, height: size },
  );
}
