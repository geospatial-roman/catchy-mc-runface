"use client";

import dynamic from "next/dynamic";
import styles from "./GameMapView.module.css";

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
    <div className={styles.root}>
      {/* Toast overlay */}
      {toast && <div className={styles.toast}>{toast.message}</div>}

      {/* Game ID badge */}
      {gameId && (
        <div className={styles.gameIdBadge}>
          Game <span className={styles.gameId}>{gameId}</span>
        </div>
      )}

      {/* Chat button + panel */}
      <div className={styles.chatWrapper}>
        {!chatOpen && (
          <button
            type="button"
            onClick={() => {
              setChatOpen(true);
            }}
            className={styles.chatToggleButton}
          >
            <span>Chat</span>
            {chatUnread > 0 && (
              <span className={styles.chatUnread}>{chatUnread}</span>
            )}
          </button>
        )}

        {chatOpen && (
          <div className={styles.chatPanel}>
            <div className={styles.chatHeaderRow}>
              <span className={styles.chatTitle}>Game chat</span>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className={styles.chatCloseButton}
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div className={styles.chatTabs}>
              <button
                type="button"
                onClick={() => setSelectedChatChannel("all")}
                className={`${styles.chatTab} ${
                  selectedChatChannel === "all"
                    ? styles.chatTabAllActive
                    : ""
                }`}
              >
                All players
              </button>
              {canUseDetectivesChannel && (
                <button
                  type="button"
                  onClick={() => setSelectedChatChannel("detectives")}
                  className={`${styles.chatTab} ${
                    selectedChatChannel === "detectives"
                      ? styles.chatTabDetectivesActive
                      : ""
                  }`}
                >
                  Detectives
                </button>
              )}
            </div>

            <div className={styles.chatMessages}>
              {visibleMessages.length === 0 && (
                <p className={styles.chatEmpty}>
                  No messages yet. Use chat to coordinate your moves!
                </p>
              )}
              {visibleMessages.map((m) => {
                const isOwn =
                  m.player_id && playerId && m.player_id === playerId;
                const inDetectivesChannel = m.channel === "detectives";

                let bubbleBg;
                let bubbleColor;

                if (inDetectivesChannel) {
                  bubbleBg = isOwn ? "#16a34a" : "#22c55e";
                  bubbleColor = "white";
                } else {
                  bubbleBg = isOwn ? "#b91c1c" : "#374151";
                  bubbleColor = "white";
                }

                return (
                  <div
                    key={m.id}
                    className={
                      isOwn ? styles.chatRowOwn : styles.chatRowOther
                    }
                  >
                    <div
                      className={styles.chatBubble}
                      style={{
                        backgroundColor: bubbleBg,
                        color: bubbleColor
                      }}
                    >
                      <div className={styles.chatBubbleHeader}>
                        <span className={styles.chatSender}>
                          {m.sender_name}
                        </span>
                        <span className={styles.chatTime}>
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                      <div>{m.message}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.chatInputRow}>
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
                className={styles.chatInput}
              />
              <button
                type="button"
                onClick={handleSendChat}
                className={styles.chatSendButton}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <MapContainer center={center} zoom={15} className={styles.map}>
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
