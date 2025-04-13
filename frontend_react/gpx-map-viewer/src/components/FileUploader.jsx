import React, { useState } from "react";
import axios from "axios";

function FileUploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");  // Reset previous errors
    
    try {
      await axios.post("http://localhost:8000/upload", formData);
      onUploadSuccess();
    } catch (err) {
      setError("File upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input type="file" accept=".gpx" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Upload"}
      </button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
}

export default FileUploader;
