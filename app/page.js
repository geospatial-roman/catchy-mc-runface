"use client";

import { useState, useEffect, useRef } from "react";
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

import * as turf from "@turf/turf";

const defaultCenter = [51.505, -0.09]; // fallback map center

export default function HomePage() {
  // "lobby" | "waiting" | "game"
  const [stage, setStage] = useState("lobby");

  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [role, setRole] = useState("detective"); // chosen: "mr_x" | "detective"
  const [playerColor, setPlayerColor] = useState(null);

  const [position, setPosition] = useState(null); // [lat, lng]
  const [gpsReady, setGpsReady] = useState(false);

  const [boundary, setBoundary] = useState(null); // GeoJSON from border.geojson
  const [insideBoundary, setInsideBoundary] = useState(true);

  const [players, setPlayers] = useState([]);

  const [toast, setToast] = useState(null); // { message: string } | null

  // game room logic
  const [gameMode, setGameMode] = useState("new"); // "new" | "join"
  const [gameId, setGameId] = useState(""); // active game ID (uppercase)

  const routeRef = useRef([]);

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

          // 🔵 Detectives: send position "live" on every GPS update
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
  // 🔴 Mr. X: send position every 10 seconds
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
  // Waiting stage: poll for Mr. X to appear + update detective list
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

    // For "new" mode, we let the backend create the game (no gameId).
    // For "join" mode, we require an entered gameId.
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

  // ------------------------------------------------------------
  // Convert boundary GeoJSON → Leaflet polygon positions
  // ------------------------------------------------------------
  const polygonCoords =
    boundary?.features?.[0]?.geometry?.coordinates?.[0]?.map(
      ([lng, lat]) => [lat, lng]
    );

    // ------------------------------------------------------------
  // Lobby UI
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
          backgroundPosition: "center",
        }}
      >
        {/* Card on top of the background */}
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            padding: "1.5rem",
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.92)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            backdropFilter: "blur(6px)",
          }}
        >
          <h1
            style={{
              fontSize: "1.8rem",
              fontWeight: 700,
              marginBottom: "1rem",
              textAlign: "center",
            }}
          >
            Catchy McRunface
          </h1>

          {/* Game mode selection */}
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "1rem",
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
                cursor: "pointer",
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
                cursor: "pointer",
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
                color: "#4b5563",
              }}
            >
              When you join, a game ID will be created automatically.
              <br />
              You&apos;ll see it in the waiting room and in the game view and
              can share it with your friends.
            </div>
          ) : (
            <div style={{ marginBottom: "1rem" }}>
              <p
                style={{ marginBottom: "0.25rem", fontWeight: 600 }}
              >
                Enter game ID to join:
              </p>
              <input
                type="text"
                value={gameId}
                onChange={(e) =>
                  setGameId(e.target.value.toUpperCase())
                }
                placeholder="e.g. F7K2XP"
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  borderRadius: 4,
                  border: "1px solid #ccc",
                  backgroundColor: "rgba(255,255,255,0.9)",
                }}
              />
            </div>
          )}

          {/* Name + role */}
          <label
            style={{
              display: "block",
              marginBottom: "0.25rem",
              marginTop: "0.5rem",
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
              backgroundColor: "rgba(255,255,255,0.9)",
            }}
            placeholder="Detective Alice / Mr. X"
          />

          <div style={{ marginBottom: "1rem" }}>
            <p
              style={{ marginBottom: "0.25rem", fontWeight: 600 }}
            >
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
              marginBottom: "0.5rem",
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
            <strong
              style={{ color: insideBoundary ? "green" : "red" }}
            >
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
              cursor: "pointer",
            }}
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }


    // ------------------------------------------------------------
  // Waiting for Mr. X UI (with detective list)
  // ------------------------------------------------------------
  if (stage === "waiting") {
    const detectives = players.filter((p) => p.role === "detective");

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
          backgroundPosition: "center",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            padding: "1.5rem",
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.92)",
            boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            backdropFilter: "blur(6px)",
            textAlign: "center",
          }}
        >
          <div className="spinner" />
          <h2 style={{ marginBottom: "0.5rem" }}>
            Waiting for Mr. X to join.
          </h2>
          <p style={{ color: "#555", marginBottom: "1.5rem" }}>
            You joined as a detective in game{" "}
            <span
              style={{
                fontFamily: "monospace",
                fontWeight: 700,
              }}
            >
              {gameId}
            </span>
            . The game will start automatically when Mr. X joins.
          </p>

          <div
            style={{
              textAlign: "left",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: "0.75rem",
              backgroundColor: "#f9fafb",
            }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                marginBottom: "0.5rem",
              }}
            >
              Connected detectives
            </h3>
            {detectives.length === 0 && (
              <p
                style={{
                  fontSize: "0.9rem",
                  color: "#6b7280",
                }}
              >
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
                  marginBottom: "0.25rem",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: d.color || "blue",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: "0.95rem" }}>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }


  // ------------------------------------------------------------
  // Game map UI
  // ------------------------------------------------------------
  const center = position || defaultCenter;

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
          Game&nbsp;
          <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{gameId}</span>
        </div>
      )}

      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {polygonCoords && (
          <Polygon positions={polygonCoords} pathOptions={{ color: "red" }} />
        )}

        {players.map((pl) => {
          if (!pl.position) return null;
          const [lng, lat] = pl.position;
          const isMrX = pl.role === "mr_x";

          // 🔴 Mr. X red, detectives use their assigned color (fallback to blue)
          const color = isMrX ? "red" : pl.color || "blue";

          return (
            <CircleMarker
              key={pl.id}
              center={[lat, lng]}
              radius={5}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.6 }}
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
