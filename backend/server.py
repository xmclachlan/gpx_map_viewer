from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from typing import List
import uvicorn
import xml.etree.ElementTree as ET
import json

app = FastAPI(title="GPX Map Viewer API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define directories
UPLOAD_DIR = "uploads"
METADATA_FILE = "track_metadata.json"

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Function to load track metadata


def load_metadata():
    if os.path.exists(METADATA_FILE):
        try:
            with open(METADATA_FILE, "r") as f:
                return json.load(f)
        except:
            return {}
    return {}

# Function to save track metadata


def save_metadata(metadata):
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f)

# Serve the static files directly from root


@app.get("/", response_class=HTMLResponse)
async def get_index():
    """Serve the index.html file"""
    return FileResponse("index.html")


@app.get("/style.css")
async def get_css():
    """Serve the CSS file"""
    return FileResponse("style.css")


@app.get("/script.js")
async def get_js():
    """Serve the JavaScript file"""
    return FileResponse("script.js")


@app.get("/uploads/", response_model=List[str])
async def list_gpx_files():
    """List all GPX files in the uploads directory"""
    try:
        if not os.path.exists(UPLOAD_DIR):
            return []
        files = [f for f in os.listdir(UPLOAD_DIR) if f.endswith('.gpx')]
        return files
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error listing files: {str(e)}")


@app.post("/uploads/")
async def upload_gpx_file(file: UploadFile = File(...)):
    """Upload a GPX file"""
    try:
        # Validate file extension
        if not file.filename.lower().endswith('.gpx'):
            raise HTTPException(
                status_code=400, detail="Only GPX files are allowed")

        # Create the file path
        file_path = os.path.join(UPLOAD_DIR, file.filename)

        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Optional: Validate GPX format
        try:
            tree = ET.parse(file_path)
            root = tree.getroot()

            # Check for GPX namespace
            if not root.tag.endswith('gpx'):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid GPX file format"
                )
        except ET.ParseError:
            # Delete the invalid file
            os.remove(file_path)
            raise HTTPException(
                status_code=400,
                detail="Invalid XML format in GPX file"
            )

        return {"filename": file.filename, "status": "File uploaded successfully"}

    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error uploading file: {str(e)}")


@app.get("/uploads/{filename}")
async def get_gpx_file(filename: str):
    """Get a specific GPX file"""
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    if not filename.endswith('.gpx'):
        raise HTTPException(status_code=400, detail="File is not a GPX file")

    return FileResponse(file_path)


@app.delete("/uploads/{filename}")
async def delete_gpx_file(filename: str):
    """Delete a specific GPX file"""
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        os.remove(file_path)

        # Update metadata if we're tracking it
        metadata = load_metadata()
        if filename in metadata:
            del metadata[filename]
            save_metadata(metadata)

        return {"message": f"File {filename} deleted successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting file: {str(e)}")

# Endpoint to save track metadata (for custom fields)


@app.post("/metadata/{filename}")
async def save_track_metadata(filename: str, data: dict):
    """Save metadata for a specific track"""
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        metadata = load_metadata()
        metadata[filename] = data
        save_metadata(metadata)
        return {"message": "Metadata saved successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error saving metadata: {str(e)}")

# Endpoint to get track metadata


@app.get("/metadata/{filename}")
async def get_track_metadata(filename: str):
    """Get metadata for a specific track"""
    file_path = os.path.join(UPLOAD_DIR, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        metadata = load_metadata()
        return metadata.get(filename, {})
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error retrieving metadata: {str(e)}")

if __name__ == "__main__":
    # Run the FastAPI app with uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
