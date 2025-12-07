"use client";

import { useState, useEffect, useRef } from "react";
import * as turf from "@turf/turf";

import Lobby from "../components/Lobby";
import WaitingRoom from "../components/WaitingRoom";
import GameMapView from "../components/GameMapView";

// Munich center
const defaultCenter = [48.13721715108601, 11.576205475595202];

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

  // Responsive flag
  const [isMobile, setIsMobile] = useState(false);

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
  // Mobile / desktop detection
  // ------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
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

  // ------------------------------------------------------------
  // Back to lobby with confirmation
  // ------------------------------------------------------------
  const handleBackToLobby = () => {
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
  // Stage-based rendering
  // ------------------------------------------------------------
  if (stage === "lobby") {
    return (
      <Lobby
        name={name}
        setName={setName}
        role={role}
        setRole={setRole}
        gameMode={gameMode}
        setGameMode={setGameMode}
        gameId={gameId}
        setGameId={setGameId}
        gpsReady={gpsReady}
        insideBoundary={insideBoundary}
        handleJoinGame={handleJoinGame}
      />
    );
  }

  if (stage === "waiting") {
    const detectives = players.filter((p) => p.role === "detective");
    const visibleMessages = chatMessages.filter((m) =>
      selectedChatChannel === "detectives"
        ? m.channel === "detectives"
        : m.channel === "all"
    );

    return (
      <WaitingRoom
        isMobile={isMobile}
        detectives={detectives}
        gameId={gameId}
        visibleMessages={visibleMessages}
        canUseDetectivesChannel={role === "detective"}
        selectedChatChannel={selectedChatChannel}
        setSelectedChatChannel={setSelectedChatChannel}
        chatInput={chatInput}
        setChatInput={setChatInput}
        handleSendChat={handleSendChat}
        handleBackToLobby={handleBackToLobby}
        playerId={playerId}
        formatTime={formatTime}
      />
    );
  }

  // stage === "game"
  const center = position || defaultCenter;
  const visibleMessages = chatMessages.filter((m) =>
    selectedChatChannel === "detectives"
      ? m.channel === "detectives"
      : m.channel === "all"
  );

  return (
    <GameMapView
      toast={toast}
      gameId={gameId}
      chatOpen={chatOpen}
      setChatOpen={setChatOpen}
      chatUnread={chatUnread}
      visibleMessages={visibleMessages}
      canUseDetectivesChannel={role === "detective"}
      selectedChatChannel={selectedChatChannel}
      setSelectedChatChannel={setSelectedChatChannel}
      chatInput={chatInput}
      setChatInput={setChatInput}
      handleSendChat={handleSendChat}
      formatTime={formatTime}
      players={players}
      center={center}
      polygonCoords={polygonCoords}
      role={role}
      playerId={playerId}
    />
  );
}
