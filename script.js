// Test April 13, 2140

// Global variables to store track layers and their metadata
const trackLayers = new Map();
let map;

// Initialize the map when DOM content is loaded
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    loadAvailableFiles();
    setupUploadForm();
});

// Initialize OpenLayers map
function initMap() {
    map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            // Sydney, Australia coordinates
            center: ol.proj.fromLonLat([151.2093, -33.8688]),
            zoom: 10
        })
    });
}

// Set up the file upload form
function setupUploadForm() {
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const progressBar = document.getElementById('upload-progress');
    const progressIndicator = progressBar.querySelector('.progress');
    
    uploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a GPX file to upload');
            return;
        }
        
        if (!file.name.toLowerCase().endsWith('.gpx')) {
            alert('Only GPX files are supported');
            return;
        }
        
        // Create FormData object to send the file
        const formData = new FormData();
        formData.append('file', file);
        
        // Show progress bar
        progressBar.style.display = 'block';
        progressIndicator.style.width = '0%';
        
        try {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', function(e) {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressIndicator.style.width = percentComplete + '%';
                }
            });
            
            // Handle completion
            xhr.addEventListener('load', function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    // Success
                    progressIndicator.style.width = '100%';
                    fileInput.value = ''; // Reset file input
                    
                    setTimeout(() => {
                        progressBar.style.display = 'none';
                        // Reload file list to include the new file
                        loadAvailableFiles();
                    }, 1000);
                } else {
                    // Error
                    alert(`Upload failed: ${xhr.statusText}`);
                    progressBar.style.display = 'none';
                }
            });
            
            // Handle errors
            xhr.addEventListener('error', function() {
                alert('Upload failed: Network error');
                progressBar.style.display = 'none';
            });
            
            // Open and send the request
            xhr.open('POST', '/uploads/');
            xhr.send(formData);
            
        } catch (error) {
            console.error('Error uploading file:', error);
            alert(`Error uploading file: ${error.message}`);
            progressBar.style.display = 'none';
        }
    });
}

// Fetch and display available GPX files
async function loadAvailableFiles() {
    const loader = document.getElementById('loader');
    const fileList = document.getElementById('file-list');
    
    try {
        loader.style.display = 'block';
        const response = await fetch('/uploads/');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const files = await response.json();
        
        // Clear existing list
        fileList.innerHTML = '';
        
        if (files.length === 0) {
            fileList.innerHTML = '<li class="file-item">No GPX files available</li>';
            return;
        }
        
        // Create list items for each file
        files.forEach(filename => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.dataset.filename = filename;
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            nameDiv.textContent = filename;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'file-actions';
            
            // Create toggle view button with dynamic text based on loaded state
            const viewBtn = document.createElement('button');
            viewBtn.className = 'view-btn';
            // Set initial text based on whether track is loaded
            viewBtn.textContent = trackLayers.has(filename) ? 'Hide Track' : 'View Track';
            viewBtn.addEventListener('click', function() {
                if (trackLayers.has(filename)) {
                    // If track is loaded, remove it
                    removeTrack(filename);
                    this.textContent = 'View Track';
                } else {
                    // If track is not loaded, load it
                    loadAndDisplayTrack(filename);
                    this.textContent = 'Hide Track';
                }
            });
            
            // Add toggle visibility button (only shows when track is loaded)
            const visibilityBtn = document.createElement('button');
            visibilityBtn.className = 'visibility-btn';
            visibilityBtn.textContent = trackLayers.has(filename) && trackLayers.get(filename).visible ? 'Hide' : 'Show';
            visibilityBtn.style.display = trackLayers.has(filename) ? 'inline-block' : 'none';
            visibilityBtn.addEventListener('click', function() {
                if (trackLayers.has(filename)) {
                    const trackData = trackLayers.get(filename);
                    const newVisibility = !trackData.visible;
                    toggleTrackVisibility(filename, newVisibility);
                    this.textContent = newVisibility ? 'Hide' : 'Show';
                }
            });
            
            // Add delete track button (only shows when track is loaded)
            const deleteTrackBtn = document.createElement('button');
            deleteTrackBtn.className = 'delete-track-btn';
            deleteTrackBtn.textContent = 'Remove Track';
            deleteTrackBtn.style.display = trackLayers.has(filename) ? 'inline-block' : 'none';
            deleteTrackBtn.addEventListener('click', function() {
                removeTrack(filename);
                // Update button visibility after track is removed
                this.style.display = 'none';
                visibilityBtn.style.display = 'none';
                viewBtn.textContent = 'View Track';
            });
            
            // Delete file button (always visible)
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Delete File';
            deleteBtn.addEventListener('click', () => deleteFileFromServer(filename));
            
            actionsDiv.appendChild(viewBtn);
            actionsDiv.appendChild(visibilityBtn);
            actionsDiv.appendChild(deleteTrackBtn);
            actionsDiv.appendChild(deleteBtn);
            
            li.appendChild(nameDiv);
            li.appendChild(actionsDiv);
            fileList.appendChild(li);
        });
        
        // Update track controls for any loaded tracks
        updateTrackControls();
        
    } catch (error) {
        console.error('Error loading file list:', error);
        fileList.innerHTML = '<li class="file-item">Error loading GPX files. Please try again later.</li>';
    } finally {
        loader.style.display = 'none';
    }
}

// Load and display a GPX track on the map
async function loadAndDisplayTrack(filename) {
    const loader = document.getElementById('loader');
    
    try {
        loader.style.display = 'block';
        
        // If track is already loaded, just zoom to it
        if (trackLayers.has(filename)) {
            zoomToTrack(filename);
            return;
        }
        
        const response = await fetch(`/uploads/${filename}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const gpxData = await response.text();
        
        // Parse GPX and extract track points
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxData, 'text/xml');
        const trackPoints = Array.from(gpxDoc.querySelectorAll('trkpt')).map(trkpt => {
            return [
                parseFloat(trkpt.getAttribute('lon')),
                parseFloat(trkpt.getAttribute('lat'))
            ];
        });
        
        if (trackPoints.length === 0) {
            throw new Error('No track points found in the GPX file');
        }
        
        // Create a line feature from track points
        const lineFeature = new ol.Feature({
            geometry: new ol.geom.LineString(trackPoints).transform('EPSG:4326', 'EPSG:3857')
        });
        
        // Get track name from GPX if available
        let trackName = filename;
        const gpxTrackName = gpxDoc.querySelector('trk > name');
        if (gpxTrackName && gpxTrackName.textContent) {
            trackName = gpxTrackName.textContent;
        }
        
        // Generate a random color for the track
        const trackColor = getRandomColor();
        
        // Create a vector layer with the line feature
        const vectorLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
                features: [lineFeature]
            }),
            style: new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: trackColor,
                    width: 4
                })
            })
        });
        
        // Add the layer to the map
        map.addLayer(vectorLayer);
        
        // Store the track data
        trackLayers.set(filename, {
            layer: vectorLayer,
            feature: lineFeature,
            visible: true,
            color: trackColor,
            displayName: trackName,
            category: 'Uncategorized'
        });
        
        // Update the view button to say "Hide Track"
        const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
        if (fileItem) {
            const viewBtn = fileItem.querySelector('.view-btn');
            if (viewBtn) {
                viewBtn.textContent = 'Hide Track';
            }
            
            // Show the visibility and delete track buttons
            const visibilityBtn = fileItem.querySelector('.visibility-btn');
            if (visibilityBtn) {
                visibilityBtn.style.display = 'inline-block';
                visibilityBtn.textContent = 'Hide'; // Default to visible when first loaded
            }
            
            const deleteTrackBtn = fileItem.querySelector('.delete-track-btn');
            if (deleteTrackBtn) {
                deleteTrackBtn.style.display = 'inline-block';
            }
        }
        
        // Create or update the track controls
        updateTrackControls();
        
        // Zoom to the track
        zoomToTrack(filename);
        
    } catch (error) {
        console.error('Error loading track:', error);
        alert(`Error loading track: ${error.message}`);
    } finally {
        loader.style.display = 'none';
    }
}

// Update the track controls in the file list
function updateTrackControls() {
    // Create detail sections for all loaded tracks
    trackLayers.forEach((trackData, filename) => {
        const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
        
        if (!fileItem) return;
        
        // Remove existing details section if present
        const existingDetails = fileItem.querySelector('.track-details');
        if (existingDetails) {
            existingDetails.remove();
        }
        
        // Create details section
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'track-details';
        
        // Toggle visibility control
        const visibilityControl = document.createElement('div');
        visibilityControl.className = 'detail-control';
        
        const visibilityLabel = document.createElement('span');
        visibilityLabel.textContent = 'Visible: ';
        
        const visibilityToggle = document.createElement('input');
        visibilityToggle.type = 'checkbox';
        visibilityToggle.checked = trackData.visible;
        visibilityToggle.addEventListener('change', (e) => {
            toggleTrackVisibility(filename, e.target.checked);
        });
        
        visibilityControl.appendChild(visibilityLabel);
        visibilityControl.appendChild(visibilityToggle);
        
        // Rename control
        const renameControl = document.createElement('div');
        renameControl.className = 'detail-control';
        
        const renameLabel = document.createElement('span');
        renameLabel.textContent = 'Name: ';
        
        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = trackData.displayName;
        renameInput.className = 'track-name-input';
        renameInput.addEventListener('change', (e) => {
            renameTrack(filename, e.target.value);
        });
        
        renameControl.appendChild(renameLabel);
        renameControl.appendChild(renameInput);
        
        // Color control
        const colorControl = document.createElement('div');
        colorControl.className = 'detail-control';
        
        const colorLabel = document.createElement('span');
        colorLabel.textContent = 'Color: ';
        
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = rgbToHex(trackData.color);
        colorInput.className = 'track-color-input';
        colorInput.addEventListener('change', (e) => {
            changeTrackColor(filename, e.target.value);
        });
        
        colorControl.appendChild(colorLabel);
        colorControl.appendChild(colorInput);
        
        // Category control
        const categoryControl = document.createElement('div');
        categoryControl.className = 'detail-control';
        
        const categoryLabel = document.createElement('span');
        categoryLabel.textContent = 'Category: ';
        
        const categorySelect = document.createElement('select');
        categorySelect.className = 'track-category-select';
        
        // Add category options
        ['Uncategorized', 'Running', 'Cycling', 'Hiking', 'Driving', 'Walking'].forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            if (category === trackData.category) {
                option.selected = true;
            }
            categorySelect.appendChild(option);
        });
        
        categorySelect.addEventListener('change', (e) => {
            categorizeTrack(filename, e.target.value);
        });
        
        categoryControl.appendChild(categoryLabel);
        categoryControl.appendChild(categorySelect);
        
        // Add all controls to details
        detailsDiv.appendChild(visibilityControl);
        detailsDiv.appendChild(renameControl);
        detailsDiv.appendChild(colorControl);
        detailsDiv.appendChild(categoryControl);
        
        // Add details to file item
        fileItem.appendChild(detailsDiv);
    });
}

// Toggle track visibility
function toggleTrackVisibility(filename, visible) {
    if (trackLayers.has(filename)) {
        const trackData = trackLayers.get(filename);
        trackData.visible = visible;
        trackData.layer.setVisible(visible);
        trackLayers.set(filename, trackData);
        
        // Update the visibility checkbox in the track details
        const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
        if (fileItem) {
            const visibilityCheckbox = fileItem.querySelector('.track-details input[type="checkbox"]');
            if (visibilityCheckbox) {
                visibilityCheckbox.checked = visible;
            }
        }
    }
}

// Rename a track
function renameTrack(filename, newName) {
    if (trackLayers.has(filename)) {
        const trackData = trackLayers.get(filename);
        trackData.displayName = newName || filename;
        trackLayers.set(filename, trackData);
    }
}

// Change track color
function changeTrackColor(filename, newColor) {
    if (trackLayers.has(filename)) {
        const trackData = trackLayers.get(filename);
        trackData.color = newColor;
        trackData.layer.setStyle(new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: newColor,
                width: 4
            })
        }));
        trackLayers.set(filename, trackData);
    }
}

// Categorize a track
function categorizeTrack(filename, category) {
    if (trackLayers.has(filename)) {
        const trackData = trackLayers.get(filename);
        trackData.category = category;
        trackLayers.set(filename, trackData);
    }
}

// Remove a track from the map
function removeTrack(filename) {
    if (trackLayers.has(filename)) {
        const { layer } = trackLayers.get(filename);
        map.removeLayer(layer);
        trackLayers.delete(filename);
        
        // Update UI
        const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
        if (fileItem) {
            // Update view button text
            const viewBtn = fileItem.querySelector('.view-btn');
            if (viewBtn) {
                viewBtn.textContent = 'View Track';
            }
            
            // Hide the visibility and delete track buttons
            const visibilityBtn = fileItem.querySelector('.visibility-btn');
            if (visibilityBtn) {
                visibilityBtn.style.display = 'none';
            }
            
            const deleteTrackBtn = fileItem.querySelector('.delete-track-btn');
            if (deleteTrackBtn) {
                deleteTrackBtn.style.display = 'none';
            }
            
            // Remove track details section
            const detailsDiv = fileItem.querySelector('.track-details');
            if (detailsDiv) {
                detailsDiv.remove();
            }
        }
    }
}

function deleteFileFromServer(filename) {
    if (!confirm(`Are you sure you want to permanently delete "${filename}"? This cannot be undone.`)) {
        return; // User cancelled
    }
    
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    
    fetch(`/uploads/${filename}`, {
        method: 'DELETE',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Remove the track from map if it's loaded
        if (trackLayers.has(filename)) {
            removeTrack(filename);
        }
        
        // Remove the file item from the list
        const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
        if (fileItem) {
            fileItem.remove();
        }
        
        alert(`File "${filename}" deleted successfully`);
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        alert(`Error deleting file: ${error.message}`);
    })
    .finally(() => {
        loader.style.display = 'none';
    });
}

// Zoom the map to fit a track
function zoomToTrack(filename) {
    if (trackLayers.has(filename)) {
        const { feature } = trackLayers.get(filename);
        const extent = feature.getGeometry().getExtent();
        map.getView().fit(extent, {
            padding: [50, 50, 50, 50],
            duration: 1000
        });
    }
}

// Add the deleteFileFromServer function
function deleteFileFromServer(filename) {
    if (!confirm(`Are you sure you want to permanently delete "${filename}"? This cannot be undone.`)) {
        return; // User cancelled
    }
    
    const loader = document.getElementById('loader');
    loader.style.display = 'block';
    
    fetch(`/uploads/${filename}`, {
        method: 'DELETE',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Remove the track from map if it's loaded
        if (trackLayers.has(filename)) {
            removeTrack(filename);
        }
        
        // Remove the file item from the list
        const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
        if (fileItem) {
            fileItem.remove();
        }
        
        // If file list is now empty, show the "No GPX files available" message
        const fileList = document.getElementById('file-list');
        if (fileList.children.length === 0) {
            fileList.innerHTML = '<li class="file-item">No GPX files available</li>';
        }
        
        alert(`File "${filename}" deleted successfully`);
    })
    .catch(error => {
        console.error('Error deleting file:', error);
        alert(`Error deleting file: ${error.message}`);
    })
    .finally(() => {
        loader.style.display = 'none';
    });
}

// Generate a random color for track lines
function getRandomColor() {
    const colors = [
        '#FF5733', // Red-Orange
        '#33FF57', // Green
        '#3357FF', // Blue
        '#FF33A8', // Pink
        '#33A8FF', // Light Blue
        '#A833FF', // Purple
        '#FFD133', // Yellow
        '#33FFD1', // Cyan
        '#D133FF'  // Magenta
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Convert RGB color to HEX format
function rgbToHex(rgb) {
    // If it's already a hex color, return it
    if (rgb.startsWith('#')) {
        return rgb;
    }
    
    // Extract RGB values
    const rgbValues = rgb.match(/\d+/g);
    if (!rgbValues || rgbValues.length < 3) {
        return '#000000'; // Default to black if parsing fails
    }
    
    // Convert RGB to HEX
    const r = parseInt(rgbValues[0]).toString(16).padStart(2, '0');
    const g = parseInt(rgbValues[1]).toString(16).padStart(2, '0');
    const b = parseInt(rgbValues[2]).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
}