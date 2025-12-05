export const metadata = {
  title: "Real-Life Scotland Yard",
  description: "MVP for a real-world Scotland Yard game"
};

import "../styles/globals.css";
import "leaflet/dist/leaflet.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
