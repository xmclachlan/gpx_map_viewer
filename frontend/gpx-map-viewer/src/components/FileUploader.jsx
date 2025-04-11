import React, { useState } from "react";
import axios from "axios";

function FileUploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await axios.post("http://localhost:8000/upload", formData);
    onUploadSuccess();
  };

  return (
    <div>
      <input type="file" accept=".gpx" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}

export default FileUploader;
