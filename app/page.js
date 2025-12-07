"use client";

import { useState, useEffect, useRef } from "react";
import * as turf from "@turf/turf";

import Lobby from "../components/Lobby";
import WaitingRoom from "../components/WaitingRoom";
import GameMapView from "../components/GameMapView";
import DefineAreaMap from "../components/DefineAreaMap"; // ⬅️ NEW


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

  const [selectedPreset, setSelectedPreset] = useState(null);




  // Mobile/desktop detection
  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const checkInsideBoundary = (latLng, geojson) => {
    if (!latLng || !geojson?.features?.[0]) return true;
    const [lat, lng] = latLng;
    const pt = turf.point([lng, lat]);
    return turf.booleanPointInPolygon(pt, geojson.features[0]);
  };

  // GPS tracking
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
          routeRef.current.push({
            t: Date.now(),
            p: [latLng[1], latLng[0]]
          });

          if (playerId && role === "detective" && gameId) {
            const [lat, lng] = latLng;
            fetch("/api/update-position", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId,
                gameId,
                position: [lng, lat]
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

  // Mr. X send every 10s
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
            position: [lng, lat]
          })
        });
      } catch (err) {
        console.error("Mr. X update failed", err);
      }
    };

    sendMrXPosition();
    const interval = setInterval(sendMrXPosition, 10_000);
    return () => clearInterval(interval);
  }, [stage, playerId, role, position, gameId]);

  // Poll players in game
  useEffect(() => {
    if (stage !== "game" || !gameId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/players?gameId=${gameId}`);
        const data = await res.json();
        if (!data.error) setPlayers(data || []);
      } catch (err) {
        console.error("Failed to fetch players", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [stage, gameId]);

  // Waiting: poll for Mr. X
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

  // Toast auto-hide
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Chat polling
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

    fetchMessages();
    const interval = setInterval(fetchMessages, 2000);
    return () => clearInterval(interval);
  }, [stage, gameId, role, chatOpen]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !gameId) return;

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
    } catch (err) {
      console.error("Network error sending chat message", err);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleOpenDefineArea = () => {
		  setStage("define-area");
		};



	const handleSaveDefinedArea = (geojson) => {
  setBoundary(geojson);
  setSelectedPreset("User Defined");   // ← THIS SETS THE BADGE

  if (position) {
    setInsideBoundary(checkInsideBoundary(position, geojson));
  }

  setStage("lobby");
};



	const handleSelectPredefinedArea = async (key) => {
	  try {
		if (key === "munich-classic") {
		  const res = await fetch("/border.geojson");
		  if (!res.ok) throw new Error("Failed to load border.geojson");
		  const data = await res.json();
		  setBoundary(data);

		  if (position) {
			setInsideBoundary(checkInsideBoundary(position, data));
		  }
		}
		// you can add more keys here later
	  } catch (err) {
		console.error("Failed to load predefined game area", err);
		alert("Could not load predefined game area.");
	  }
	};

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

      setChatMessages([]);
      setChatUnread(0);
      lastMessageTimeRef.current = null;
      setSelectedChatChannel("all");

      // persist it to Supabase for this game
		if (gameMode === "new" && boundary) {
		  try {
			await fetch("/api/game-boundary", {
			  method: "POST",
			  headers: { "Content-Type": "application/json" },
			  body: JSON.stringify({
				gameId: joinedGameId,
				boundary
			  })
			});
		  } catch (err) {
			console.error("Failed to save game boundary", err);
		  }
		}

		// NEW: load the boundary from Supabase (for joiners and to confirm host)
		try {
		  const resBoundary = await fetch(
			`/api/game-boundary?gameId=${joinedGameId}`
		  );
		  const bData = await resBoundary.json();
		  if (bData.boundary) {
			setBoundary(bData.boundary);
			if (position) {
			  setInsideBoundary(
				checkInsideBoundary(position, bData.boundary)
			  );
			}
		  }
		} catch (err) {
		  console.error("Failed to load game boundary", err);
		}

      if (joinedRole === "mr_x") {
        setStage("game");
      } else {
        try {
          const playersRes = await fetch(`/api/players?gameId=${joinedGameId}`);
          const list = await playersRes.json();
          if (!list.error) setPlayers(list || []);
          const hasMrX =
            Array.isArray(list) && list.some((p) => p.role === "mr_x");
          setStage(hasMrX ? "game" : "waiting");
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

  const polygonCoords =
    boundary?.features?.[0]?.geometry?.coordinates?.[0]?.map(
      ([lng, lat]) => [lat, lng]
    );

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
        onDefineArea={handleOpenDefineArea}
      	hasBoundary={!!boundary}
      	onSelectPredefinedArea={handleSelectPredefinedArea}
      	selectedPreset={selectedPreset}
        setSelectedPreset={setSelectedPreset}

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

  if (stage === "define-area") {
	  return (
		<DefineAreaMap
		  position={position}
		  onSaveBoundary={handleSaveDefinedArea}
		  onCancel={() => setStage("lobby")}
		/>
	  );
	}


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
