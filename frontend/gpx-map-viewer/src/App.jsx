import React, { useState, useEffect } from "react";
import FileUploader from "./components/FileUploader";
import MapViewer from "./components/MapViewer";
import axios from "axios";

function App() {
  const [gpxFiles, setGpxFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:8000/files").then((res) => {
      setGpxFiles(res.data.files);
    });
  }, []);

  return (
    <div>
      <h1>GPX Viewer</h1>
      <FileUploader onUploadSuccess={() => window.location.reload()} />
      <select multiple onChange={(e) => {
        const files = Array.from(e.target.selectedOptions).map(opt => opt.value);
        setSelectedFiles(files);
      }}>
        {gpxFiles.map(file => (
          <option key={file} value={file}>{file}</option>
        ))}
      </select>
      <MapViewer selectedFiles={selectedFiles} />
    </div>
  );
}

export default App;
