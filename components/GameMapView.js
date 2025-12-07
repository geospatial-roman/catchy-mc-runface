"use client";

import dynamic from "next/dynamic";

// Dynamically import react-leaflet components on client only
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);

const Polygon = dynamic(
  () => import("react-leaflet").then((m) => m.Polygon),
  { ssr: false }
);

const Tooltip = dynamic(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false }
);

const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);

export default function GameMapView({
  toast,
  gameId,
  chatOpen,
  setChatOpen,
  chatUnread,
  visibleMessages,
  canUseDetectivesChannel,
  selectedChatChannel,
  setSelectedChatChannel,
  chatInput,
  setChatInput,
  handleSendChat,
  formatTime,
  players,
  center,
  polygonCoords,
  role,
  playerId
}) {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Toast overlay */}
      {toast && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "rgba(31, 41, 55, 0.95)",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: 999,
            fontSize: "0.9rem",
            zIndex: 1000,
            boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Game ID badge */}
      {gameId && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            color: "white",
            padding: "0.3rem 0.8rem",
            borderRadius: 999,
            fontSize: "0.85rem",
            zIndex: 1000
          }}
        >
          Game{" "}
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
            {gameId}
          </span>
        </div>
      )}

      {/* Chat button + panel */}
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          zIndex: 1000
        }}
      >
        {!chatOpen && (
          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
              // unread counter is reset in parent
            }}
            style={{
              padding: "0.5rem 0.8rem",
              borderRadius: 999,
              border: "none",
              backgroundColor: "rgba(15,23,42,0.9)",
              color: "white",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
            }}
          >
            <span>Chat</span>
            {chatUnread > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  backgroundColor: "#ef4444",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 700
                }}
              >
                {chatUnread}
              </span>
            )}
          </button>
        )}

        {chatOpen && (
          <div
            style={{
              width: 280,
              maxHeight: 340,
              borderRadius: 12,
              backgroundColor: "rgba(15,23,42,0.95)",
              color: "white",
              padding: "0.6rem",
              boxShadow: "0 8px 20px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "0.4rem"
              }}
            >
              <span
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  flex: 1
                }}
              >
                Game chat
              </span>
              <button
                type="button"
                onClick={() => {
                  setChatOpen(false);
                }}
                style={{
                  border: "none",
                  background: "none",
                  color: "#e5e7eb",
                  cursor: "pointer",
                  fontSize: "1rem",
                  padding: "0 0.2rem"
                }}
              >
                ×
              </button>
            </div>

            {/* Channel tabs */}
            <div
              style={{
                display: "flex",
                gap: "0.3rem",
                marginBottom: "0.3rem"
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedChatChannel("all")}
                style={{
                  flex: 1,
                  padding: "0.22rem 0.4rem",
                  borderRadius: 999,
                  border:
                    selectedChatChannel === "all"
                      ? "2px solid #f97316"
                      : "1px solid #4b5563",
                  backgroundColor:
                    selectedChatChannel === "all"
                      ? "rgba(239,68,68,0.3)"
                      : "rgba(31,41,55,0.95)",
                  color: "white",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                All players
              </button>
              {canUseDetectivesChannel && (
                <button
                  type="button"
                  onClick={() => setSelectedChatChannel("detectives")}
                  style={{
                    flex: 1,
                    padding: "0.22rem 0.4rem",
                    borderRadius: 999,
                    border:
                      selectedChatChannel === "detectives"
                        ? "2px solid #4ade80"
                        : "1px solid #4b5563",
                    backgroundColor:
                      selectedChatChannel === "detectives"
                        ? "rgba(22,163,74,0.4)"
                        : "rgba(15,23,42,0.9)",
                    color: "white",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Detectives
                </button>
              )}
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: "0.4rem",
                paddingRight: "0.2rem",
                fontSize: "0.85rem"
              }}
            >
              {visibleMessages.length === 0 && (
                <p style={{ color: "#9ca3af" }}>
                  No messages yet. Use chat to coordinate your moves!
                </p>
              )}
              {visibleMessages.map((m) => {
                const isOwn = m.player_id && playerId && m.player_id === playerId;
                const inDetectivesChannel = m.channel === "detectives";

                let bubbleBg;
                let bubbleColor;

                if (inDetectivesChannel) {
                  // Detectives channel → green theme
                  bubbleBg = isOwn ? "#16a34a" : "#22c55e";
                  bubbleColor = "white";
                } else {
                  // All players channel → grey + red theme
                  bubbleBg = isOwn ? "#b91c1c" : "#374151";
                  bubbleColor = "white";
                }

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: isOwn ? "flex-end" : "flex-start",
                      marginBottom: "0.25rem"
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "80%",
                        padding: "0.25rem 0.5rem",
                        borderRadius: 8,
                        backgroundColor: bubbleBg,
                        color: bubbleColor,
                        fontSize: "0.8rem"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                          marginBottom: "0.1rem"
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "0.78rem"
                          }}
                        >
                          {m.sender_name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.7rem",
                            opacity: 0.8
                          }}
                        >
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                      <div>{m.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.3rem"
              }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder={
                  selectedChatChannel === "detectives"
                    ? "Detectives-only message…"
                    : "Message to all players…"
                }
                style={{
                  flex: 1,
                  padding: "0.35rem 0.45rem",
                  borderRadius: 6,
                  border: "1px solid #4b5563",
                  fontSize: "0.8rem",
                  backgroundColor: "rgba(15,23,42,0.9)",
                  color: "white"
                }}
              />
              <button
                type="button"
                onClick={handleSendChat}
                style={{
                  padding: "0.35rem 0.55rem",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "white",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {polygonCoords && (
          <Polygon positions={polygonCoords} pathOptions={{ color: "red" }} />
        )}

        {players.map((pl) => {
          if (!pl.position) return null;
          const [lng, lat] = pl.position;
          const isMrX = pl.role === "mr_x";

          const color = isMrX ? "red" : pl.color || "blue";

          return (
            <CircleMarker
              key={pl.id}
              center={[lat, lng]}
              radius={5}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span>
                  {pl.name} {isMrX ? "(Mr. X)" : ""}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
