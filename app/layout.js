

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


export const metadata = {
  title: "Catchy McRunface",
  description: "MVP for a real-world hide and seek game"
};

import "../styles/globals.css";
import "leaflet/dist/leaflet.css";

