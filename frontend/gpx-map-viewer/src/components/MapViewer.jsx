import React, { useState, useEffect, useRef } from "react";
import "ol/ol.css";  // OpenLayers CSS
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import XYZ from "ol/source/XYZ"; // To use Mapbox or other tile sources
import { fromLonLat } from "ol/proj"; // For converting coordinates
import { Style, Stroke } from "ol/style";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON";
import * as extent from "ol/extent"; // Import extent functions from ol/extent

function MapViewer({ selectedFiles, setSelectedFiles }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [fileBounds, setFileBounds] = useState({});
  const [layerMap, setLayerMap] = useState({});

  useEffect(() => {
    const map = new Map({
      target: mapContainerRef.current,
      layers: [
        new TileLayer({
          source: new XYZ({
            url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          }),
        }),
      ],
      view: new View({
        center: fromLonLat([151.21, -33.87]),  // Sydney coordinates
        zoom: 10,
      }),
    });

    mapInstanceRef.current = map;

    return () => map.setTarget(undefined);
  }, []);

  useEffect(() => {
    if (selectedFiles.length === 0) return;

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
        (b, coord) => extent.extend(b, [coord[0], coord[1]]),
        extent.createEmpty()  // Initialize empty extent
      );

      const vectorSource = new VectorSource({
        features: [new GeoJSON().readFeature(geojson)],
      });

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: new Style({
          stroke: new Stroke({
            color: "#FF5733",  // Line color
            width: 3,
          }),
        }),
      });

      const map = mapInstanceRef.current;
      map.addLayer(vectorLayer);

      // Store the bounds and layers for removal
      setFileBounds((prev) => ({ ...prev, [fileName]: bounds }));
      setLayerMap((prev) => ({ ...prev, [fileName]: vectorLayer }));
    });
  }, [selectedFiles]);

  const handleZoomToFile = (fileName) => {
    const map = mapInstanceRef.current;
    const bounds = fileBounds[fileName];

    if (map && bounds) {
      const view = map.getView();
      view.fit(bounds, { padding: [40, 40, 40, 40], duration: 1000 });
    }
  };

  const handleRemoveFile = async (fileName) => {
    const encodedFileName = encodeURIComponent(fileName);
    try {
      const res = await fetch(`http://localhost:8000/uploads/${encodedFileName}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete the file");
      }

      const map = mapInstanceRef.current;
      const layer = layerMap[fileName];
      if (layer) {
        map.removeLayer(layer);
      }

      setSelectedFiles((prevFiles) => prevFiles.filter((file) => file !== fileName));
      setFileBounds((prev) => {
        const newState = { ...prev };
        delete newState[fileName];
        return newState;
      });
      setLayerMap((prev) => {
        const newState = { ...prev };
        delete newState[fileName];
        return newState;
      });
    } catch (error) {
      console.error("Error removing file:", error);
      alert("Failed to remove the file. Please try again.");
    }
  };

  return (
    <div>
      {/* Menu with clickable file names and delete buttons */}
      <div style={{ marginBottom: "8px" }}>
        {selectedFiles.map((fileName) => (
          <div key={fileName} style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
            <button
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
            <button
              onClick={() => handleRemoveFile(fileName)}
              style={{
                padding: "6px 12px",
                cursor: "pointer",
                backgroundColor: "#f44336",
                color: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div ref={mapContainerRef} style={{ height: "600px", width: "100%" }} />
    </div>
  );
}

export default MapViewer;
