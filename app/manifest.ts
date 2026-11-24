import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hand & Foot Scores",
    short_name: "Hand & Foot",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#1f6f4a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
