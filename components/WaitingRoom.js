import styles from "./WaitingRoom.module.css";

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
    <div className={styles.background}>
      {/* Desktop detectives panel */}
      {!isMobile && (
        <div className={styles.detectivesPanelDesktop}>
          <h3 className={styles.detectivesTitle}>Connected detectives</h3>
          {detectives.length === 0 && (
            <p className={styles.detectivesEmpty}>
              No other detectives yet. Share the game ID with your friends!
            </p>
          )}
          {detectives.map((d) => (
            <div key={d.id} className={styles.detectiveRow}>
              <span
                className={styles.detectiveColorDot}
                style={{ backgroundColor: d.color || "blue" }}
              />
              <span className={styles.detectiveName}>{d.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Centered card */}
      <div className={styles.centerWrapper}>
        <div className={styles.card}>
          {/* Mobile detectives list inside card */}
          {isMobile && (
            <div className={styles.detectivesPanelMobile}>
              <h3 className={styles.detectivesTitle}>Connected detectives</h3>
              {detectives.length === 0 && (
                <p className={styles.detectivesEmpty}>
                  No other detectives yet. Share the game ID with your friends!
                </p>
              )}
              {detectives.map((d) => (
                <div key={d.id} className={styles.detectiveRow}>
                  <span
                    className={styles.detectiveColorDot}
                    style={{ backgroundColor: d.color || "blue" }}
                  />
                  <span className={styles.detectiveName}>{d.name}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <div className="spinner" />
            <h2 className={styles.waitingTitle}>Waiting for Mr. X to join.</h2>
            <p className={styles.waitingText}>
              You joined as a detective in game{" "}
              <span className={styles.gameId}>{gameId}</span>. The game will
              start automatically when Mr. X joins.
            </p>
          </div>

          {/* Chat panel */}
          <div className={styles.chatPanel}>
            <div className={styles.chatHeaderRow}>
              <h3 className={styles.chatTitle}>Detective chat</h3>
            </div>

            {/* Channel tabs */}
            <div className={styles.chatTabs}>
              <button
                type="button"
                onClick={() => setSelectedChatChannel("all")}
                className={`${styles.chatTab} ${
                  selectedChatChannel === "all" ? styles.chatTabAllActive : ""
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
                  bubbleBg = isOwn ? "#16a34a" : "#bbf7d0";
                  bubbleColor = isOwn ? "white" : "#064e3b";
                } else {
                  bubbleBg = isOwn ? "#b91c1c" : "#e5e7eb";
                  bubbleColor = isOwn ? "white" : "#111827";
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

          <button
            type="button"
            onClick={handleBackToLobby}
            className={styles.backButton}
          >
            ← Back to lobby
          </button>
        </div>
      </div>
    </div>
  );
}
