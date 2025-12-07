import { backgroundFull, mainCardBase } from "../lib/layoutStyles";

export default function WaitingRoom({
  isMobile,
  detectives,
  gameId,
  visibleMessages,
  canUseDetectivesChannel,
  selectedChatChannel,
  setSelectedChatChannel,
  chatInput,
  setChatInput,
  handleSendChat,
  handleBackToLobby,
  playerId,
  formatTime
}) {
  return (
    <div
      style={{
        ...backgroundFull,
        position: "relative"
      }}
    >
      {/* Top-left: Connected detectives panel (desktop only) */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            maxWidth: 260,
            padding: "0.75rem",
            borderRadius: 12,
            backgroundColor: "rgba(249,250,251,0.95)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            border: "1px solid #e5e7eb",
            textAlign: "left",
            zIndex: 100
          }}
        >
          <h3
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              marginBottom: "0.5rem"
            }}
          >
            Connected detectives
          </h3>
          {detectives.length === 0 && (
            <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              No other detectives yet. Share the game ID with your friends!
            </p>
          )}
          {detectives.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.25rem"
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  backgroundColor: d.color || "blue",
                  display: "inline-block"
                }}
              />
              <span style={{ fontSize: "0.95rem" }}>{d.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Centered card */}
      <div
        style={{
          minHeight: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        <div
          style={{
            ...mainCardBase,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "1rem"
          }}
        >
          {/* Mobile: detectives list inside card */}
          {isMobile && (
            <div
              style={{
                marginBottom: "0.5rem",
                padding: "0.75rem",
                borderRadius: 10,
                backgroundColor: "rgba(249,250,251,0.95)",
                border: "1px solid #e5e7eb",
                textAlign: "left"
              }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  marginBottom: "0.4rem"
                }}
              >
                Connected detectives
              </h3>
              {detectives.length === 0 && (
                <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                  No other detectives yet. Share the game ID with your friends!
                </p>
              )}
              {detectives.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.25rem"
                  }}
                >
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      backgroundColor: d.color || "blue",
                      display: "inline-block"
                    }}
                  />
                  <span style={{ fontSize: "0.95rem" }}>{d.name}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="spinner" />
            <h2 style={{ marginBottom: "0.5rem" }}>
              Waiting for Mr. X to join.
            </h2>
            <p style={{ color: "#555", marginBottom: "0.5rem" }}>
              You joined as a detective in game{" "}
              <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                {gameId}
              </span>
              . The game will start automatically when Mr. X joins.
            </p>
          </div>

          {/* Chat panel */}
          <div
            style={{
              textAlign: "left",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "0.75rem",
              backgroundColor: "#f9fafb",
              maxHeight: "280px",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.4rem"
              }}
            >
              <h3
                style={{
                  fontSize: "1rem",
                  fontWeight: 600
                }}
              >
                Detective chat
              </h3>
            </div>

            {/* Channel tabs */}
            <div
              style={{
                display: "flex",
                gap: "0.35rem",
                marginBottom: "0.4rem"
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedChatChannel("all")}
                style={{
                  flex: 1,
                  padding: "0.25rem 0.4rem",
                  borderRadius: 999,
                  border:
                    selectedChatChannel === "all"
                      ? "2px solid #ef4444"
                      : "1px solid #9ca3af",
                  backgroundColor:
                    selectedChatChannel === "all" ? "#f3f4f6" : "white",
                  color: "#111827",
                  fontSize: "0.8rem",
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
                    padding: "0.25rem 0.4rem",
                    borderRadius: 999,
                    border:
                      selectedChatChannel === "detectives"
                        ? "2px solid #16a34a"
                        : "1px solid #d1d5db",
                    backgroundColor:
                      selectedChatChannel === "detectives"
                        ? "#dcfce7"
                        : "white",
                    color: "#064e3b",
                    fontSize: "0.8rem",
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
                marginBottom: "0.5rem",
                paddingRight: "0.25rem"
              }}
            >
              {visibleMessages.length === 0 && (
                <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
                  No messages yet. Say hi to your fellow detectives!
                </p>
              )}
              {visibleMessages.map((m) => {
                const isOwn =
                  m.player_id && playerId && m.player_id === playerId;
                const inDetectivesChannel = m.channel === "detectives";

                let bubbleBg;
                let bubbleColor;

                if (inDetectivesChannel) {
                  // Detectives channel → green theme
                  bubbleBg = isOwn ? "#16a34a" : "#bbf7d0";
                  bubbleColor = isOwn ? "white" : "#064e3b";
                } else {
                  // All players channel → grey + red theme
                  bubbleBg = isOwn ? "#b91c1c" : "#e5e7eb";
                  bubbleColor = isOwn ? "white" : "#111827";
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
                        fontSize: "0.85rem"
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
                            fontSize: "0.8rem"
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
                gap: "0.5rem",
                marginTop: "0.25rem"
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
                  padding: "0.4rem 0.5rem",
                  borderRadius: 4,
                  border: "1px solid #d1d5db",
                  fontSize: "0.9rem"
                }}
              />
              <button
                type="button"
                onClick={handleSendChat}
                style={{
                  padding: "0.4rem 0.7rem",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "white",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Send
              </button>
            </div>
          </div>

          {/* Back to lobby button */}
          <button
            type="button"
            onClick={handleBackToLobby}
            style={{
              alignSelf: "flex-start",
              marginTop: "0.5rem",
              padding: "0.4rem 0.8rem",
              borderRadius: 999,
              border: "1px solid #d1d5db",
              backgroundColor: "white",
              fontSize: "0.85rem",
              cursor: "pointer"
            }}
          >
            ← Back to lobby
          </button>
        </div>
      </div>
    </div>
  );
}
