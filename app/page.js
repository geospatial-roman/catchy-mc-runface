"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import * as turf from "@turf/turf";

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

const defaultCenter = [48.13721715108601, 11.576205475595202]; // fallback map center

export default function HomePage() {
  // "lobby" | "waiting" | "game"
  const [stage, setStage] = useState("lobby");

  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [role, setRole] = useState("detective"); // "mr_x" | "detective"
  const [playerColor, setPlayerColor] = useState(null);

  const [position, setPosition] = useState(null); // [lat, lng]
  const [gpsReady, setGpsReady] = useState(false);

  const [boundary, setBoundary] = useState(null);
  const [insideBoundary, setInsideBoundary] = useState(true);

  const [players, setPlayers] = useState([]);

  const [toast, setToast] = useState(null); // { message } | null

  // game room logic
  const [gameMode, setGameMode] = useState("new"); // "new" | "join"
  const [gameId, setGameId] = useState(""); // active game ID (uppercase)

  const routeRef = useRef([]);

  // CHAT STATE
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatOpen, setChatOpen] = useState(false); // in game stage
  const [chatUnread, setChatUnread] = useState(0);
  const [selectedChatChannel, setSelectedChatChannel] = useState("all"); // "all" | "detectives"
  const lastMessageTimeRef = useRef(null);

  // ------------------------------------------------------------
  // Load the GeoJSON file from the public folder
  // ------------------------------------------------------------
  useEffect(() => {
    const loadBoundary = async () => {
      try {
        const res = await fetch("/border.geojson");
        const data = await res.json();
        setBoundary(data);
      } catch (err) {
        console.error("Failed to load border.geojson", err);
      }
    };
    loadBoundary();
  }, []);

  // ------------------------------------------------------------
  // Boundary check using turf
  // ------------------------------------------------------------
  const checkInsideBoundary = (latLng, geojson) => {
    if (!latLng || !geojson?.features?.[0]) return true;
    const [lat, lng] = latLng;
    const pt = turf.point([lng, lat]); // GeoJSON order: [lng, lat]
    return turf.booleanPointInPolygon(pt, geojson.features[0]);
  };

  // ------------------------------------------------------------
  // GPS tracking
  // ------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      console.warn("Geolocation not available");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const latLng = [pos.coords.latitude, pos.coords.longitude];
        setPosition(latLng);
        setGpsReady(true);

        if (boundary) {
          setInsideBoundary(checkInsideBoundary(latLng, boundary));
        }

        if (stage === "game") {
          // log route in memory
          routeRef.current.push({
            t: Date.now(),
            p: [latLng[1], latLng[0]] // store [lng, lat]
          });

          // Detectives: send position live
          if (playerId && role === "detective" && gameId) {
            const [lat, lng] = latLng;
            fetch("/api/update-position", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId,
                gameId,
                position: [lng, lat] // [lng, lat]
              })
            }).catch((err) => console.error("Detective update failed", err));
          }
        }
      },
      (err) => {
        console.error("GPS error", err);
        setGpsReady(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [boundary, stage, playerId, role, gameId]);

  // ------------------------------------------------------------
  // Mr. X: send position every 10 seconds
  // ------------------------------------------------------------
  useEffect(() => {
    if (stage !== "game" || !playerId || role !== "mr_x" || !gameId) return;

    const sendMrXPosition = async () => {
      if (!position) return;
      const [lat, lng] = position;

      try {
        await fetch("/api/update-position", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            gameId,
            position: [lng, lat] // [lng, lat]
          })
        });
      } catch (err) {
        console.error("Mr. X update failed", err);
      }
    };

    // send once immediately
    sendMrXPosition();

    // then every 10 seconds
    const interval = setInterval(sendMrXPosition, 10_000);
    return () => clearInterval(interval);
  }, [stage, playerId, role, position, gameId]);

  // ------------------------------------------------------------
  // Poll all players from backend (game stage)
  // ------------------------------------------------------------
  useEffect(() => {
    if (stage !== "game" || !gameId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/players?gameId=${gameId}`);
        const data = await res.json();
        if (!data.error) {
          setPlayers(data || []);
        }
      } catch (err) {
        console.error("Failed to fetch players", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [stage, gameId]);

  // ------------------------------------------------------------
  // Waiting stage: poll for Mr. X + update detective list
  // ------------------------------------------------------------
  useEffect(() => {
    if (stage !== "waiting" || !gameId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/players?gameId=${gameId}`);
        const data = await res.json();
        if (data.error) return;
        setPlayers(data || []);

        const hasMrX = data.some((p) => p.role === "mr_x");

        if (hasMrX) {
          setToast({ message: "Mr. X joined, starting game..." });
          setStage("game");
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Failed to check for Mr. X", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [stage, gameId]);

  // ------------------------------------------------------------
  // Toast auto-hide
  // ------------------------------------------------------------
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 4000);

    return () => clearTimeout(timer);
  }, [toast]);

  // ------------------------------------------------------------
  // CHAT: poll messages in waiting & game stages
  // ------------------------------------------------------------
  useEffect(() => {
    if (!gameId || (stage !== "waiting" && stage !== "game")) return;

    const fetchMessages = async () => {
      try {
        const params = new URLSearchParams({
          gameId,
          role: role || ""
        });
        const res = await fetch(`/api/chat/list?${params.toString()}`);
        const data = await res.json();
        if (data.error) return;

        setChatMessages(data);

        if (data.length > 0) {
          const latestTime = data.reduce((max, m) => {
            const t = new Date(m.created_at).getTime();
            return t > max ? t : max;
          }, 0);

          if (
            lastMessageTimeRef.current &&
            latestTime > lastMessageTimeRef.current &&
            !chatOpen
          ) {
            setChatUnread((prev) => prev + 1);
          }

          lastMessageTimeRef.current = latestTime;
        }
      } catch (err) {
        console.error("Failed to fetch chat messages", err);
      }
    };

    // initial fetch
    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);

    return () => clearInterval(interval);
  }, [stage, gameId, role, chatOpen]);

  // ------------------------------------------------------------
  // Send chat message
  // ------------------------------------------------------------
  const handleSendChat = async () => {
    if (!chatInput.trim() || !gameId) return;

    // Detectives can choose channel; Mr. X always "all"
    let channel = "all";
    if (role === "detective" && selectedChatChannel === "detectives") {
      channel = "detectives";
    }

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          name: name || "Unknown",
          message: chatInput.trim(),
          channel
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error("Chat send failed:", data.error || res.statusText);
        return;
      }

      setChatInput("");
      // Next poll will load the new message
    } catch (err) {
      console.error("Network error sending chat message", err);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // ------------------------------------------------------------
  // Join game (create new or join existing)
  // ------------------------------------------------------------
  const handleJoinGame = async () => {
    if (!gpsReady || !position) {
      alert("Waiting for GPS… make sure location is enabled.");
      return;
    }
    if (!insideBoundary) {
      alert("You must be inside the game area to join.");
      return;
    }
    if (!name.trim()) {
      alert("Please enter a name.");
      return;
    }

    const trimmedGameId =
      gameMode === "join" ? (gameId || "").trim().toUpperCase() : "";

    if (gameMode === "join" && !trimmedGameId) {
      alert("Please enter a game ID.");
      return;
    }

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, gameId: trimmedGameId })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Could not join game");
        return;
      }

      const data = await res.json();
      const joinedRole = data.role;
      const joinedGameId = data.gameId.toUpperCase();

      setPlayerId(data.playerId);
      setRole(joinedRole);
      setPlayerColor(data.color || null);
      setGameId(joinedGameId);

      // Reset chat state for this game
      setChatMessages([]);
      setChatUnread(0);
      lastMessageTimeRef.current = null;
      setSelectedChatChannel("all");

      if (joinedRole === "mr_x") {
        setStage("game");
      } else {
        // Detective: check if Mr. X is already present
        try {
          const playersRes = await fetch(`/api/players?gameId=${joinedGameId}`);
          const list = await playersRes.json();
          if (!list.error) {
            setPlayers(list || []);
          }
          const hasMrX = Array.isArray(list) && list.some((p) => p.role === "mr_x");
          if (hasMrX) {
            setStage("game");
          } else {
            setStage("waiting");
          }
        } catch {
          setStage("waiting");
        }
      }
    } catch (err) {
      console.error("Failed to join game", err);
      alert("Network error joining game");
    }
  };

    const handleBackToLobby = () => {
  // Ask for confirmation before leaving the game
  const sure = window.confirm(
    "Do you really want to leave this game and go back to the lobby?"
  );
  if (!sure) return;

  setStage("lobby");
  setGameId("");
  setPlayers([]);
  setChatMessages([]);
  setChatUnread(0);
  lastMessageTimeRef.current = null;
};



  // ------------------------------------------------------------
  // Convert boundary GeoJSON → Leaflet polygon positions
  // ------------------------------------------------------------
  const polygonCoords =
    boundary?.features?.[0]?.geometry?.coordinates?.[0]?.map(
      ([lng, lat]) => [lat, lng]
    );

  // ------------------------------------------------------------
  // LOBBY
  // ------------------------------------------------------------
  if (stage === "lobby") {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "1.5rem",
          backgroundImage: 'url("/munich-map-bg.png")',
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            padding: "1.5rem",
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.92)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            backdropFilter: "blur(6px)"
          }}
        >
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
              You&apos;ll see it in the waiting room and in the game view and
              can share it with your friends.
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
              {gpsReady
                ? "OK"
                : "Not ready – allow location in your browser"}
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

    // ------------------------------------------------------------
  // WAITING ROOM (with detective list top-left + chat)
  // ------------------------------------------------------------
  if (stage === "waiting") {
    const detectives = players.filter((p) => p.role === "detective");
    const visibleMessages = chatMessages.filter((m) =>
      selectedChatChannel === "detectives"
        ? m.channel === "detectives"
        : m.channel === "all"
    );

    const canUseDetectivesChannel = role === "detective";

    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100vw",
          position: "relative",
          padding: "1.5rem",
          backgroundImage: 'url("/munich-map-bg.png")',
          backgroundSize: "cover",
          backgroundPosition: "center"
        }}
      >
        {/* Top-left: Connected detectives panel */}
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

        {/* Centered waiting card */}
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
              width: "100%",
              maxWidth: 520,
              padding: "1.5rem",
              borderRadius: 16,
              backgroundColor: "rgba(255,255,255,0.92)",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              backdropFilter: "blur(6px)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              gap: "1rem"
            }}
          >
            <div>
              <div className="spinner" />
              <h2 style={{ marginBottom: "0.5rem" }}>
                Waiting for Mr. X to join.
              </h2>
              <p style={{ color: "#555", marginBottom: "0.5rem" }}>
                You joined as a detective in game{" "}
                <span
                  style={{ fontFamily: "monospace", fontWeight: 700 }}
                >
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
                  const inDetectivesChannel =
                    m.channel === "detectives";

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
                        justifyContent: isOwn
                          ? "flex-end"
                          : "flex-start",
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


  // ------------------------------------------------------------
  // GAME MAP UI (with collapsible chat + channels)
  // ------------------------------------------------------------
  const center = position || defaultCenter;
  const canUseDetectivesChannel = role === "detective";
  const visibleMessages = chatMessages.filter((m) =>
    selectedChatChannel === "detectives"
      ? m.channel === "detectives"
      : m.channel === "all"
  );

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
              setChatUnread(0);
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
                  setChatUnread(0);
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
                      ? "2px solid #60a5fa"
                      : "1px solid #4b5563",
                  backgroundColor:
                    selectedChatChannel === "all"
                      ? "rgba(37,99,235,0.3)"
                      : "rgba(15,23,42,0.9)",
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
                        backgroundColor: isOwn ? "#2563eb" : "#374151",
                        color: "white",
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
