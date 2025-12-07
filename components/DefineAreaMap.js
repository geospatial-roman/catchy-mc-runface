"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import * as turf from "@turf/turf";
import { useMapEvents } from "react-leaflet";
import styles from "./DefineAreaMap.module.css";

// Dynamic react-leaflet components
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
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);

// fallback center (Marienplatz-ish)
const defaultCenter = [48.13721715108601, 11.576205475595202];

function DrawingEvents({ isDrawing, onMapClick }) {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      const { lat, lng } = e.latlng;
      onMapClick([lat, lng]);
    }
  });
  return null;
}

export default function DefineAreaMap({ position, onSaveBoundary, onCancel }) {
  // "polygon" | "rectangle" | "circle"
  const [mode, setMode] = useState("polygon");

  // Draw mode on/off
  const [isDrawing, setIsDrawing] = useState(false);

  // Polygon points: [ [lat, lng], ... ]
  const [points, setPoints] = useState([]);

  // Rectangle corners: up to 2 [lat, lng]
  const [rectCorners, setRectCorners] = useState([]);

  // Circle: center [lat, lng] + turf-generated polygon feature
  const [circleCenter, setCircleCenter] = useState(null);
  const [circleFeature, setCircleFeature] = useState(null);

  const center = position || defaultCenter;

  const resetAllShapes = () => {
    setPoints([]);
    setRectCorners([]);
    setCircleCenter(null);
    setCircleFeature(null);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    resetAllShapes();
  };

  const handleMapClick = ([lat, lng]) => {
    if (mode === "polygon") {
      setPoints((prev) => [...prev, [lat, lng]]);
      return;
    }

    if (mode === "rectangle") {
      setRectCorners((prev) => {
        if (prev.length === 0) {
          return [[lat, lng]];
        }
        if (prev.length === 1) {
          return [prev[0], [lat, lng]];
        }
        // If already 2 corners, start over with new first corner
        return [[lat, lng]];
      });
      return;
    }

    if (mode === "circle") {
      // First click sets center, second click sets radius
      if (!circleCenter) {
        setCircleCenter([lat, lng]);
        setCircleFeature(null);
      } else {
        const centerLngLat = [circleCenter[1], circleCenter[0]];
        const edgeLngLat = [lng, lat];

        const radiusKm = turf.distance(centerLngLat, edgeLngLat, {
          units: "kilometers"
        });

        const circle = turf.circle(centerLngLat, radiusKm, {
          steps: 64,
          units: "kilometers"
        });

        setCircleFeature(circle);
      }
    }
  };

  const handleUndo = () => {
    if (mode === "polygon") {
      setPoints((prev) => prev.slice(0, -1));
    } else if (mode === "rectangle") {
      setRectCorners((prev) => prev.slice(0, -1));
    } else if (mode === "circle") {
      if (circleFeature) {
        setCircleFeature(null);
      } else if (circleCenter) {
        setCircleCenter(null);
      }
    }
  };

  const handleDelete = () => {
    resetAllShapes();
  };

  // Is there a valid shape to save?
  const shapeReady =
    (mode === "polygon" && points.length >= 3) ||
    (mode === "rectangle" && rectCorners.length === 2) ||
    (mode === "circle" && !!circleFeature);

  const handleSave = () => {
    if (!shapeReady) return;

    let feature;

    if (mode === "polygon") {
      const ring = [
        ...points.map(([lat, lng]) => [lng, lat]),
        [points[0][1], points[0][0]] // close polygon
      ];

      feature = {
        type: "Feature",
        properties: { mode: "polygon" },
        geometry: {
          type: "Polygon",
          coordinates: [ring]
        }
      };
    } else if (mode === "rectangle") {
      const [[lat1, lng1], [lat2, lng2]] = rectCorners;

      const ringLatLng = [
        [lat1, lng1],
        [lat1, lng2],
        [lat2, lng2],
        [lat2, lng1],
        [lat1, lng1]
      ];

      const ring = ringLatLng.map(([la, ln]) => [ln, la]);

      feature = {
        type: "Feature",
        properties: { mode: "rectangle" },
        geometry: {
          type: "Polygon",
          coordinates: [ring]
        }
      };
    } else if (mode === "circle" && circleFeature) {
      feature = {
        ...circleFeature,
        properties: { ...(circleFeature.properties || {}), mode: "circle" }
      };
    }

    const geojson = {
      type: "FeatureCollection",
      features: [feature]
    };

    onSaveBoundary(geojson);
  };

  // Derived geometries for preview
  const polygonPositions = points.length ? points : null;

  let rectanglePositions = null;
  if (rectCorners.length === 2) {
    const [[lat1, lng1], [lat2, lng2]] = rectCorners;
    rectanglePositions = [
      [lat1, lng1],
      [lat1, lng2],
      [lat2, lng2],
      [lat2, lng1]
    ];
  }

  let circlePositions = null;
  if (circleFeature?.geometry?.type === "Polygon") {
    circlePositions = circleFeature.geometry.coordinates[0].map(
      ([lng, lat]) => [lat, lng]
    );
  }

  const infoText = (() => {
    const drawState = isDrawing ? "DRAWING ON" : "DRAWING OFF";
    if (mode === "polygon") {
      return `Mode: Polygon | ${drawState} – click to add points (need at least 3). Points: ${points.length}`;
    }
    if (mode === "rectangle") {
      return `Mode: Rectangle | ${drawState} – click first corner, then opposite corner. Corners: ${rectCorners.length}/2`;
    }
    return `Mode: Circle | ${drawState} – click center, then click edge to set radius. Center: ${
      circleCenter ? "set" : "not set"
    }${circleFeature ? ", radius set" : ""}`;
  })();

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <div className={styles.title}>Define game area</div>
          <div className={styles.subtitle}>
            Use pan/zoom to find the right spot. Turn drawing ON to place
            points and define the game boundary.
          </div>
        </div>
        <div className={styles.topBarRight}>
          <button
            type="button"
            className={styles.topButton}
            onClick={onCancel}
          >
            ← Back to lobby
          </button>
        </div>
      </div>

      <div className={styles.toolsBar}>
        <span className={styles.toolsLabel}>Drawing:</span>
        <button
          type="button"
          className={`${styles.drawToggle} ${
            isDrawing ? styles.drawToggleActive : ""
          }`}
          onClick={() => setIsDrawing((prev) => !prev)}
        >
          {isDrawing ? "ON" : "OFF"}
        </button>

        <span className={styles.toolsSeparator}>|</span>

        <span className={styles.toolsLabel}>Shape:</span>
        <button
          type="button"
          className={`${styles.toolButton} ${
            mode === "polygon" ? styles.toolButtonActive : ""
          }`}
          onClick={() => handleModeChange("polygon")}
        >
          Polygon
        </button>
        <button
          type="button"
          className={`${styles.toolButton} ${
            mode === "rectangle" ? styles.toolButtonActive : ""
          }`}
          onClick={() => handleModeChange("rectangle")}
        >
          Rectangle
        </button>
        <button
          type="button"
          className={`${styles.toolButton} ${
            mode === "circle" ? styles.toolButtonActive : ""
          }`}
          onClick={() => handleModeChange("circle")}
        >
          Circle
        </button>
      </div>

      <div className={styles.mapWrapper}>
        <MapContainer
          center={center}
          zoom={15}
          className={styles.map}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {/* React-leaflet click handler */}
          <DrawingEvents
            isDrawing={isDrawing}
            onMapClick={handleMapClick}
          />

          {/* Polygon mode markers & preview */}
          {polygonPositions &&
            polygonPositions.map(([lat, lng], idx) => (
              <CircleMarker
                key={`poly-${idx}`}
                center={[lat, lng]}
                radius={4}
                pathOptions={{
                  color: "#2563eb",
                  fillColor: "#2563eb",
                  fillOpacity: 0.9
                }}
              />
            ))}

          {polygonPositions && polygonPositions.length >= 3 && (
            <Polygon
              positions={polygonPositions}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.2
              }}
            />
          )}

          {/* Rectangle preview */}
          {rectanglePositions && (
            <Polygon
              positions={rectanglePositions}
              pathOptions={{
                color: "#f97316",
                fillColor: "#fed7aa",
                fillOpacity: 0.3
              }}
            />
          )}

          {/* Circle preview (approximated polygon) */}
          {circlePositions && (
            <Polygon
              positions={circlePositions}
              pathOptions={{
                color: "#22c55e",
                fillColor: "#bbf7d0",
                fillOpacity: 0.3
              }}
            />
          )}

          {/* Circle center marker */}
          {circleCenter && (
            <CircleMarker
              center={circleCenter}
              radius={4}
              pathOptions={{
                color: "#22c55e",
                fillColor: "#22c55e",
                fillOpacity: 0.9
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className={styles.bottomBar}>
        <div className={styles.bottomLeft}>
          <span className={styles.infoText}>{infoText}</span>
        </div>
        <div className={styles.bottomRight}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleUndo}
            disabled={
              mode === "polygon"
                ? points.length === 0
                : mode === "rectangle"
                ? rectCorners.length === 0
                : !circleCenter && !circleFeature
            }
          >
            Undo
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleDelete}
            disabled={
              !points.length && !rectCorners.length && !circleCenter
            }
          >
            Delete
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleSave}
            disabled={!shapeReady}
          >
            Save area & return
          </button>
        </div>
      </div>
    </div>
  );
}
