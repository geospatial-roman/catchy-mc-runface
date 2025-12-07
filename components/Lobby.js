import { useState } from "react";
import styles from "./Lobby.module.css";

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
  handleJoinGame,
  onDefineArea,
  hasBoundary,
  onSelectPredefinedArea,

}) {
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);


	const handlePresetClick = async (key, label) => {
	  if (onSelectPredefinedArea) {
		await onSelectPredefinedArea(key);
	  }
	  setSelectedPreset(label);
	  setPresetsOpen(false);
	};



  return (
    <div className={styles.background}>
      <div className={styles.card}>
        <h1 className={styles.title}>Real-Life Scotland Yard</h1>

        {/* Game mode selection */}
        <div className={styles.modeRow}>
          <button
            type="button"
            onClick={() => setGameMode("new")}
            className={`${styles.modeButton} ${
              gameMode === "new" ? styles.modeButtonActive : ""
            }`}
          >
            Start new game
          </button>
          <button
            type="button"
            onClick={() => setGameMode("join")}
            className={`${styles.modeButton} ${
              gameMode === "join" ? styles.modeButtonActive : ""
            }`}
          >
            Join game
          </button>
        </div>

        {/* Game ID section - only for join */}
        {gameMode === "join" && (
          <div className={styles.gameIdBlock}>
            <p className={styles.labelStrong}>Enter game ID to join:</p>
            <input
              type="text"
              value={gameId}
              onChange={(e) => setGameId(e.target.value.toUpperCase())}
              placeholder="e.g. F7K2XP"
              className={styles.textInput}
            />
          </div>
        )}

        {/* NEW: define/select area for new games */}
        {gameMode === "new" && (
          <div className={styles.areaBlock}>
            <div className={styles.areaButtonsRow}>
              <button
                type="button"
                className={styles.areaButton}
                onClick={onDefineArea}
              >
                Define game area
              </button>
              <button
                type="button"
                className={styles.selectAreaButton}
                onClick={() => setPresetsOpen((prev) => !prev)}
              >
                Select game area
              </button>
            </div>

            {presetsOpen && (
              <div className={styles.areaPresets}>
                <button
				  type="button"
				  className={styles.presetItem}
				  onClick={() => handlePresetClick("munich-classic", "Munich Classic")}
				>
				  Munich Classic
				</button>

                {/* add more presets here later */}
              </div>
            )}



			{selectedPreset && (
		  	<p className={styles.areaPresetBadge}>Selected: {selectedPreset}</p>
			)}

          </div>
        )}

        {/* Name + role */}
        <label className={styles.label}>Enter your name:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.textInput}
          placeholder="Detective Alice / Mr. X"
        />

        <div className={styles.roleBlock}>
          <p className={styles.labelStrong}>Choose your role:</p>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="role"
              value="detective"
              checked={role === "detective"}
              onChange={() => setRole("detective")}
            />{" "}
            Detective
          </label>
          <label className={styles.radioLabel}>
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

        <h2 className={styles.rulesTitle}>Rules (City Classic MVP)</h2>
        <ul className={styles.rulesList}>
          <li>Movement: walking + public transport allowed</li>
          <li>Max 2 stops per transport ride (not enforced yet)</li>
          <li>Stay inside the game area</li>
          <li>Detectives: live updates, each with a unique color</li>
          <li>Mr. X: location sent every 10 seconds, shown in red</li>
        </ul>

        <p className={styles.statusLine}>
          GPS status:{" "}
          <strong>
            {gpsReady ? "OK" : "Not ready – allow location in your browser"}
          </strong>
        </p>
        <p className={styles.statusLine}>
          Inside boundary:{" "}
          <strong
            className={insideBoundary ? styles.insideYes : styles.insideNo}
          >
            {insideBoundary ? "Yes" : "No"}
          </strong>
        </p>

        <button
          onClick={handleJoinGame}
          className={`${styles.joinButton} ${
            !gpsReady ? styles.joinButtonDisabled : ""
          }`}
        >
          Join Game
        </button>
      </div>
    </div>
  );
}
