import React, { useState, useEffect } from "react";
import FileUploader from "./components/FileUploader";
import MapViewer from "./components/MapViewer";
import axios from "axios";

function App() {
  const [gpxFiles, setGpxFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Fetch available GPX files from the server
  useEffect(() => {
    const fetchFiles = async () => {
      setLoadingFiles(true);
      try {
        const res = await axios.get("http://localhost:8000/files");
        setGpxFiles(res.data.files);
      } catch (error) {
        console.error("Error fetching files:", error);
      } finally {
        setLoadingFiles(false);
      }
    };

    fetchFiles();
  }, []);

  const handleUploadSuccess = (fileName) => {
    setGpxFiles((prevFiles) => [...prevFiles, fileName]);
  };

  return (
    <div>
      <h1>GPX Viewer</h1>
      <FileUploader onUploadSuccess={handleUploadSuccess} />
      
      {loadingFiles ? (
        <p>Loading available files...</p>
      ) : (
        <>
          <select
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.selectedOptions).map(
                (opt) => opt.value
              );
              setSelectedFiles(files);
            }}
          >
            {gpxFiles.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
          <MapViewer selectedFiles={selectedFiles} />
        </>
      )}
    </div>
  );
}

export default App;
