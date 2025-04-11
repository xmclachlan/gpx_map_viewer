import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

function MapViewer({ selectedFiles }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [fileBounds, setFileBounds] = useState({}); // ✅ Store bounds by filename

  useEffect(() => {
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [151.21, -33.87],
      zoom: 10,
    });

    mapInstanceRef.current = map;

    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || selectedFiles.length === 0) return;

    selectedFiles.forEach(async (fileName) => {
      const encodedFileName = encodeURIComponent(fileName);
      const res = await fetch(`http://localhost:8000/uploads/${encodedFileName}`);
      const text = await res.text();
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(text, "text/xml");

      const trkpts = [...gpxDoc.getElementsByTagName("trkpt")].map((pt) => [
        parseFloat(pt.getAttribute("lon")),
        parseFloat(pt.getAttribute("lat")),
      ]);

      if (!trkpts.length) return;

      const geojson = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: trkpts,
        },
      };

      const bounds = trkpts.reduce(
        (b, coord) => b.extend(coord),
        new maplibregl.LngLatBounds(trkpts[0], trkpts[0])
      );

      const map = mapInstanceRef.current;

      if (map.getLayer(fileName)) map.removeLayer(fileName);
      if (map.getSource(fileName)) map.removeSource(fileName);

      map.addSource(fileName, {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: fileName,
        type: "line",
        source: fileName,
        paint: {
          "line-color": "#FF5733",
          "line-width": 3,
        },
      });

      setFileBounds((prev) => ({ ...prev, [fileName]: bounds }));
    });
  }, [selectedFiles]);

  // ✅ Zoom handler
  const handleZoomToFile = (fileName) => {
    const map = mapInstanceRef.current;
    const bounds = fileBounds[fileName];
    if (map && bounds) {
      map.fitBounds(bounds, { padding: 40, duration: 1000 });
    }
  };

  return (
    <div>
      {/* ✅ Menu with clickable file names */}
      <div style={{ marginBottom: "8px" }}>
        {selectedFiles.map((fileName) => (
          <button
            key={fileName}
            onClick={() => handleZoomToFile(fileName)}
            style={{
              marginRight: "8px",
              padding: "6px 12px",
              cursor: "pointer",
              backgroundColor: "#eee",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            {fileName}
          </button>
        ))}
      </div>
      <div ref={mapContainerRef} style={{ height: "600px", width: "100%" }} />
    </div>
  );
}

export default MapViewer;
