import { backgroundFull, mainCardBase } from "../lib/layoutStyles";

export default function Lobby({
  name,
  setName,
  role,
  setRole,
  gameMode,
  setGameMode,
  gameId,
  setGameId,
  gpsReady,
  insideBoundary,
  handleJoinGame
}) {
  return (
    <div
      style={{
        ...backgroundFull,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <div style={mainCardBase}>
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 700,
            marginBottom: "1rem",
            textAlign: "center"
          }}
        >
          Real-Life Scotland Yard
        </h1>

        {/* Game mode selection */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "1rem"
          }}
        >
          <button
            type="button"
            onClick={() => setGameMode("new")}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: 6,
              border:
                gameMode === "new"
                  ? "2px solid #2563eb"
                  : "1px solid #d1d5db",
              backgroundColor:
                gameMode === "new" ? "#eff6ff" : "rgba(255,255,255,0.9)",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Start new game
          </button>
          <button
            type="button"
            onClick={() => setGameMode("join")}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: 6,
              border:
                gameMode === "join"
                  ? "2px solid #2563eb"
                  : "1px solid #d1d5db",
              backgroundColor:
                gameMode === "join" ? "#eff6ff" : "rgba(255,255,255,0.9)",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Join game
          </button>
        </div>

        {/* Game ID section */}
        {gameMode === "new" ? (
          <div
            style={{
              marginBottom: "1rem",
              fontSize: "0.95rem",
              color: "#4b5563"
            }}
          >
            When you join, a game ID will be created automatically.
            <br />
            You&apos;ll see it in the waiting room and in the game view and can
            share it with your friends.
          </div>
        ) : (
          <div style={{ marginBottom: "1rem" }}>
            <p style={{ marginBottom: "0.25rem", fontWeight: 600 }}>
              Enter game ID to join:
            </p>
            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value.toUpperCase())}
              placeholder="e.g. F7K2XP"
              style={{
                width: "100%",
                padding: "0.5rem",
                borderRadius: 4,
                border: "1px solid #ccc",
                backgroundColor: "rgba(255,255,255,0.9)"
              }}
            />
          </div>
        )}

        {/* Name + role */}
        <label
          style={{
            display: "block",
            marginBottom: "0.25rem",
            marginTop: "0.5rem"
          }}
        >
          Enter your name:
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            width: "100%",
            padding: "0.5rem",
            borderRadius: 4,
            border: "1px solid #ccc",
            marginBottom: "1rem",
            backgroundColor: "rgba(255,255,255,0.9)"
          }}
          placeholder="Detective Alice / Mr. X"
        />

        <div style={{ marginBottom: "1rem" }}>
          <p style={{ marginBottom: "0.25rem", fontWeight: 600 }}>
            Choose your role:
          </p>
          <label style={{ marginRight: "1rem" }}>
            <input
              type="radio"
              name="role"
              value="detective"
              checked={role === "detective"}
              onChange={() => setRole("detective")}
            />{" "}
            Detective
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="mr_x"
              checked={role === "mr_x"}
              onChange={() => setRole("mr_x")}
            />{" "}
            Mr. X
          </label>
        </div>

        <h2
          style={{
            fontSize: "1.3rem",
            fontWeight: 600,
            marginBottom: "0.5rem"
          }}
        >
          Rules (City Classic MVP)
        </h2>
        <ul style={{ marginLeft: "1.2rem", marginBottom: "1rem" }}>
          <li>Movement: walking + public transport allowed</li>
          <li>Max 2 stops per transport ride (not enforced yet)</li>
          <li>Stay inside the game area</li>
          <li>Detectives: live updates, each with a unique color</li>
          <li>Mr. X: location sent every 10 seconds, shown in red</li>
        </ul>

        <p style={{ marginBottom: "0.5rem" }}>
          GPS status:{" "}
          <strong>
            {gpsReady ? "OK" : "Not ready – allow location in your browser"}
          </strong>
        </p>
        <p style={{ marginBottom: "0.5rem" }}>
          Inside boundary:{" "}
          <strong style={{ color: insideBoundary ? "green" : "red" }}>
            {insideBoundary ? "Yes" : "No"}
          </strong>
        </p>

        <button
          onClick={handleJoinGame}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: 6,
            border: "none",
            fontWeight: 600,
            backgroundColor: "#2563eb",
            color: "white",
            opacity: gpsReady ? 1 : 0.7,
            cursor: "pointer"
          }}
        >
          Join Game
        </button>
      </div>
    </div>
  );
}
