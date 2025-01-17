// ===============================
// Constants and React Hooks
// ===============================
const { useState, useEffect, useRef } = React;

// ===============================
// Utility Functions
// ===============================
function clearSessionStorage() {
  sessionStorage.clear();
}

function handleLogout() {
  fetch('/v1/user/logout', {
    method: 'GET',
    credentials: 'include',
  })
  .then(response => {
    if (response.ok) {
      clearSessionStorage();
      window.location.href = '/';
    } else {
      throw new Error('Logout failed');
    }
  })
  .catch(error => console.error('Error:', error));
}

// ===============================
// Components
// ===============================

// Rainbow Text Component
function RainbowText({ text, isAnimating }) {
  return (
    <h1 className={`rainbow-text ${isAnimating ? 'animating' : ''}`}>
      {text.split('').map((char, index) => (
        <span key={index} style={{ animationDelay: `${index * 0.1}s` }}>
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </h1>
  );
}

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
    </div>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong. Please refresh the page.</h1>;
    }
    return this.props.children;
  }
}

// Enlarged Image Component
function EnlargedUpscaledImage({ image, originalResolution, onClose, onDownload }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  const handleZoom = (delta, shouldResetPosition = false) => {
    const newScale = Math.min(Math.max(0.75, scale + delta), 3);
    setScale(newScale);
    
    if (shouldResetPosition || newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(delta);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setStartPosition({
      x: e.clientX - (position.x * scale),
      y: e.clientY - (position.y * scale)
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newX = (e.clientX - startPosition.x) / scale;
      const newY = (e.clientY - startPosition.y) / scale;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    if (scale === 1.5) {
      handleReset();
    } else {
      setScale(1.5);
      setPosition({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging, startPosition]);

  useEffect(() => {
    function updateDimensions() {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      const newWidth = vw * 0.9;
      const newHeight = vh * 0.9;
      setDimensions({
        width: newWidth,
        height: newHeight
      });
    }

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const wrapperRef = React.useRef(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const handleWheelEvent = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        handleZoom(delta);
      };

      wrapper.addEventListener('wheel', handleWheelEvent, { passive: false });
      
      return () => {
        wrapper.removeEventListener('wheel', handleWheelEvent);
      };
    }
  }, [scale]);

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="enlarged-image-overlay">
      <div className="enlarged-image-container" style={{ width: dimensions.width, height: dimensions.height }}>
        <div 
          ref={wrapperRef}
          className="enlarged-image-wrapper"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <img 
            src={image.src} 
            alt="Enlarged upscaled image" 
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
            style={{
              maxWidth: '80%',
              maxHeight: '80%',
              objectFit: 'contain',
              transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
          />
        </div>
        <div className="enlarged-image-title-container" style={{ zIndex: 2 }}>
          <div className="enlarged-image-text">
            <h2 className="enlarged-image-title">Upscaled Image</h2>
            <p className="enlarged-image-subtitle">
              Original Size: {originalResolution} |
              Upscaled Size: {image.resolution}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="icon-button close-button" style={{ zIndex: 2 }} title="Close">
          <i className="fas fa-times"></i>
        </button>
        <button onClick={() => onDownload(image.src, 'upscaled_image.png')} className="icon-button download-button" style={{ zIndex: 2 }} title="Download image">
          <i className="fas fa-download"></i>
        </button>
        
        <div className="zoom-controls">
          <button onClick={() => handleZoom(-0.05)} className="icon-button zoom-button" title="Zoom out (5%)">
            <i className="fas fa-search-minus"></i>
          </button>
          <span className="zoom-info">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={handleReset} className="icon-button reset-zoom-button" title="Reset zoom and center image">
            <i className="fas fa-compress-arrows-alt"></i>
          </button>
          <span className="image-counter">
            1 / 1
          </span>
          <button onClick={() => handleZoom(0.05)} className="icon-button zoom-button" title="Zoom in (5%)">
            <i className="fas fa-search-plus"></i>
          </button>
        </div>

      </div>
    </div>
  );
}

// ===============================
// Main Upscaler Component
// ===============================
function Upscaler() {
  const [username, setUsername] = useState('');
  const [credits, setCredits] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(() => {
    const savedPreviewData = sessionStorage.getItem('previewData');
    return savedPreviewData || null;
  });
  const [upscaledImage, setUpscaledImage] = useState(() => sessionStorage.getItem('upscaledImage'));
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [error, setError] = useState(null);
  const [resolution, setResolution] = useState(() => sessionStorage.getItem('resolution'));
  const [originalResolution, setOriginalResolution] = useState(() => 
    sessionStorage.getItem('originalResolution') || null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState(() => 
    sessionStorage.getItem('selectedFileName') || ''
  );
  const [menuItems, setMenuItems] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef(null);
  const [costs, setCosts] = useState(null);

  useEffect(() => {
    fetch('/v1/user/info')
      .then(response => response.json())
      .then(data => {
        setUsername(data.username);
        setCredits(data.credits);
        setIsLoading(false);
      });

    fetch('/v1/presets/menu')
      .then(response => response.json())
      .then(data => setMenuItems(data.menu_items))
      .catch(error => console.error('Error fetching menu items:', error));

    fetch('/v1/credits/costs')
      .then(response => response.json())
      .then(data => setCosts(data))
      .catch(error => console.error('Error fetching costs:', error));

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    try {
      if (selectedFile) {
        const fileInfo = {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          lastModified: selectedFile.lastModified
        };
        updateSessionStorage('selectedFile', fileInfo);
        updateSessionStorage('selectedFileName', selectedFile.name);
      }
      if (upscaledImage) updateSessionStorage('upscaledImage', upscaledImage);
      if (resolution) updateSessionStorage('resolution', resolution);
      if (originalResolution) updateSessionStorage('originalResolution', originalResolution);
    } catch (error) {
      console.error('Error updating session storage:', error);
    }
  }, [selectedFile, upscaledImage, resolution, originalResolution]);

  useEffect(() => {
    return () => {
      try {
        // Verify storage integrity before unmounting
        const storedFile = sessionStorage.getItem('selectedFile');
        if (storedFile) {
          const parsedFile = JSON.parse(storedFile);
          if (typeof parsedFile !== 'object') {
            console.warn('Invalid file in storage, clearing...');
            sessionStorage.removeItem('selectedFile');
          }
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
        sessionStorage.removeItem('selectedFile');
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const updateSessionStorage = (key, value) => {
    try {
      if (value === null || value === undefined) {
        sessionStorage.removeItem(key);
      } else {
        const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value.toString();
        sessionStorage.setItem(key, serializedValue);
      }
    } catch (error) {
      console.error(`Error updating session storage for key ${key}:`, error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleFileSelection = (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError('Image size must be less than 4MB.');
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setError(null);
    
    const newPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(newPreviewUrl);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      sessionStorage.setItem('previewData', reader.result);
    };
    reader.readAsDataURL(file);
    
    const img = new Image();
    img.onload = () => {
      const resolution = `${img.width} x ${img.height}`;
      setOriginalResolution(resolution);
      sessionStorage.setItem('originalResolution', resolution);
    };
    img.src = newPreviewUrl;
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedFileName('');
    setOriginalResolution(null);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.target === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    handleFileSelection(file);
  };

  const handleUpscale = async () => {
    if (!selectedFile) {
      setError('Please select an image first.');
      return;
    }

    if (!(selectedFile instanceof Blob)) {
      setError('Please reselect the image to upscale.');
      return;
    }

    setIsUpscaling(true);
    setError(null);
    setUpscaledImage(null);
    setResolution(null);

    try {
      const userResponse = await fetch('/v1/user/info');
      const userData = await userResponse.json();
      const costPerImage = costs && costs.upscale;
      
      if (userData.credits < costPerImage) {
        const neededCredits = costPerImage - userData.credits;
        throw new Error(
          `Insufficient credits. You need ${costPerImage} credits but only have ${userData.credits}.\n` +
          `You need ${neededCredits} more credits to upscale this image.\n` +
          `Visit the Topup page to purchase more credits.`
        );
      }

      // Create FormData and append the file and original resolution
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('originalRes', originalResolution);

      const response = await fetch('/v1/legacy/upscale', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.image_url) {
        setUpscaledImage(result.image_url);
        
        const img = new Image();
        img.onload = () => {
          setResolution(`${img.width} x ${img.height}`);
        };
        img.src = result.image_url;
        
        setCredits(result.credits);
      } else {
        throw new Error('No upscaled image received from the server');
      }
    } catch (error) {
      console.error('Upscale error:', error);
      setError(error.message);
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleDownload = () => {
    let downloadFileName = selectedFileName || 'image';
    
    // Remove the file extension from the original name
    const nameWithoutExtension = downloadFileName.replace(/\.[^/.]+$/, "");
    
    // Create the new file name
    const newFileName = `${nameWithoutExtension}_upscaled.png`;

    const link = document.createElement('a');
    link.href = upscaledImage;
    link.download = newFileName;
    link.click();
  };

  const handleEnlarge = () => {
    setIsEnlarged(true);
  };

  const handleCloseEnlarged = () => {
    setIsEnlarged(false);
  };

  return (
    <div className="container">
      <header className="thin-header">
        <div className="dropdown" ref={dropdownRef}>
          <button 
            className="dropbtn" 
            onClick={toggleDropdown}
            aria-haspopup="true"
            aria-expanded={isDropdownOpen}
          >
            Menu <i className="fas fa-caret-down"></i>
          </button>
          <div className={`dropdown-content ${isDropdownOpen ? 'show' : ''}`}>
            {Object.entries(menuItems).map(([name, url]) => (
              <a key={name} href={url}>{name.substring(4)}</a>
            ))}
          </div>
        </div>
        <div className="user-info">
          <i className="fas fa-user"></i>
          <span>{username} (Credits: {credits})</span>
          <a href="#" onClick={handleLogout}>Logout</a>
        </div>
      </header>
      <RainbowText text="Atelier Upscaler" isAnimating={isUpscaling} />
      <div className="copyright">© 2023-2024 Ikmal Said</div>
      
      <div
        ref={dropZoneRef}
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFile ? 'has-file' : ''}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          id="image-upload"
          className="hidden-input"
        />
        {selectedFile ? (
          <div className="preview-wrapper">
            <div className="preview-image-container">
              <img src={previewUrl} alt="Preview" className="preview-image" />
            </div>
            <div className="file-info">
              {selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)
              {originalResolution && <span> | Resolution: {originalResolution}</span>}
            </div>
            <button onClick={handleClearFile} className="clear-button">
              Clear Selection
            </button>
          </div>
        ) : (
          <div className="drop-zone-content">
            <i className="fas fa-cloud-upload-alt"></i>
            <p>Drag and drop an image here</p>
            <label htmlFor="image-upload" className="upload-button">
              Click to Upload
            </label>
          </div>
        )}
      </div>

      <button 
        onClick={handleUpscale} 
        disabled={isUpscaling || !selectedFile} 
        className={`upscale-button ${!selectedFile ? 'disabled' : ''}`}
      >
        {isUpscaling ? (
            <React.Fragment>
              <i className="fas fa-gear fa-spin" style={{ marginRight: '8px' }} />
              Upscaling... (Do not leave or refresh the page!)
            </React.Fragment>
          ) : 'Upscale'}
      </button>

      {error && (
        <div className="error">
          <div className="error-header">
            <i className="fas fa-exclamation-triangle"></i>
            <p>Error:</p>
          </div>
          <hr className="error-divider" />
          {error.split('\n').map((err, index) => (
            <p key={index} className="error-message">
              {err}
              {err.includes('Topup page') && (
                <a href="/topup" className="error-link">Click here to topup.</a>
              )}
            </p>
          ))}
        </div>
      )}

      {upscaledImage && <hr className="gallery-divider" />}

      {upscaledImage && (
        <div className="upscaled-result">
          <div className="upscaled-image-wrapper">
            <img src={upscaledImage} alt="Upscaled" className="upscaled-image" />
            <div className="image-overlay">
              <button onClick={handleDownload} className="icon-button" title="Download image">
                <i className="fas fa-download"></i>
              </button>
              <button onClick={handleEnlarge} className="icon-button" title="Enlarge image">
                <i className="fas fa-search-plus"></i>
              </button>
            </div>
          </div>
          {resolution && <p className="resolution-info">Upscaled Successfully! ({originalResolution} → {resolution})</p>}
        </div>
      )}

      {isEnlarged && upscaledImage && (
        <EnlargedUpscaledImage
          image={{ src: upscaledImage, resolution: resolution }}
          originalResolution={originalResolution}
          onClose={handleCloseEnlarged}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

// ===============================
// App Initialization
// ===============================
ReactDOM.render(
  <React.StrictMode>
    <ErrorBoundary>
      <Upscaler />
    </ErrorBoundary>
  </React.StrictMode>,
  document.getElementById('root')
);

// Global error handler
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global error:", message, source, lineno, colno, error);
  return false;
};

// ===============================
// Styles
// ===============================
const styles = `
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css');

  /* Base Styles */
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #1a1a1a;
    color: #ffffff;
    margin: 0;
    padding: 0;
  }

  input, select, button {
    font-size: 15px;
  }

  html {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  html::-webkit-scrollbar {
    display: none;
  } 

  /* Layout */
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    padding-top: 40px;
  }

  /* Header */
  .thin-header {
    background-color: #333;
    padding: 5px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
  }

  /* Dropdown Menu */
  .dropdown {
    position: relative;
    display: inline-block;
    z-index: 1001;
  }

  .dropbtn {
    background-color: transparent;
    color: #61dafb;
    padding: 0;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: color 0.3s;
  }

  .dropbtn:hover {
    color: #4fa8d5;
  }

  .dropbtn i {
    margin-left: 5px;
  }

  .dropdown-content {
    display: none;
    position: absolute;
    background-color: #444;
    min-width: 160px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    border-radius: 4px;
    overflow: hidden;
    top: 100%;
    left: 0;
  }

  .dropdown-content.show {
    display: block;
  }

  .dropdown-content a {
    font-size: 14px;
    color: #fff;
    padding: 12px 16px;
    text-decoration: none;
    display: block;
  }

  .dropdown-content a:hover {
    background-color: #555;
  }

  /* User Info */
  .user-info {
    display: flex;
    align-items: center;
    color: #fff;
    font-size: 14px;
  }

  .user-info i {
    margin-right: 5px;
  }

  .user-info span {
    margin-right: 10px;
  }

  .user-info a {
    color: #61dafb;
    text-decoration: none;
    transition: color 0.3s;
  }

  .user-info a:hover {
    color: #4fa8d5;
  }

  /* Title and Copyright */
  .rainbow-text {
    text-align: center;
    color: #61dafb;
    margin-bottom: 30px;
    transition: color 0.5s ease;
  }

  .rainbow-text span {
    display: inline-block;
    transition: color 0.5s ease;
  }

  .rainbow-text.animating span {
    animation: rainbow-colors 2s linear infinite;
  }

  .copyright {
    text-align: center;
    font-size: 12px;
    color: #666;
    margin-top: -20px;
    margin-bottom: 20px;
    opacity: 0.7;
  }

  /* File Upload Section */
  .uploader-container {
    display: flex;
    margin-bottom: 20px;
    align-items: stretch;
    height: 40px;
  }

  .file-input-container {
    flex-grow: 1;
    position: relative;
    overflow: hidden;
  }

  #file-input {
    position: absolute;
    font-size: 100px;
    right: 0;
    top: 0;
    opacity: 0;
    cursor: pointer;
    height: 100%;
  }

  .file-input-label {
    display: flex;
    align-items: center;
    padding: 0 10px;
    background-color: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 5px 0 0 5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    font-size: 15px;
    gap: 8px;
    user-select: none;
  }

  /* Buttons */
  button {
    padding: 0 20px;
    background-color: #61dafb;
    color: #1a1a1a;
    border: none;
    cursor: pointer;
    transition: background-color 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  button:disabled {
    background-color: #4fa8d5;
    cursor: not-allowed;
    opacity: 0.7;
  }

  .icon-button {
    background-color: rgba(0, 0, 0, 0.5);
    border: none;
    color: rgba(255, 255, 255, 0.7);
    font-size: 24px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 5px;
    padding: 0;
    transition: color 0.3s, background-color 0.3s;
    border-radius: 50%;
  }

  .icon-button:hover {
    color: rgba(255, 255, 255, 1);
    background-color: rgba(0, 0, 0, 0.7);
  }

  .icon-button i {
    font-size: 20px;
  }
  /* Gallery Divider */
  .gallery-divider {
    border: none;
    border-top: 1px solid #555;
    margin: 20px 0;
    width: 100%;
  }
  /* Image Display */
  .image-display {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-top: 20px;
  }

  .image-container {
    flex: 1;
    margin: 0;
    text-align: center;
    font-size: 15px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .upscaled-image {
    width: 100%;
    height: 400px;
    object-fit: contain;
    border-radius: 5px;
    background-color: rgba(0, 0, 0, 0.2);
    transition: transform 0.3s ease;
  }

  .upscaled-image-wrapper {
    position: relative;
    display: inline-block;
    width: 100%;
    height: 400px;
    overflow: hidden;
    border-radius: 5px;
    border: 1px solid #555;
    transition: border-color 0.3s ease;
  }

  .upscaled-image-wrapper:hover {
    border-color: #61dafb;
  }

  .upscaled-image-wrapper:hover .preview-image,
  .upscaled-image-wrapper:hover .upscaled-image {
    transform: scale(1.05);
  }

  /* Image Overlay */
  .image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 5px;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .upscaled-image-wrapper:hover .image-overlay {
    opacity: 1;
  }

  /* Enlarged Image View */
  .enlarged-image-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .enlarged-image-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: visible;
    border-radius: 10px;
  }

  .enlarged-image-container img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 10px;
  }

  .enlarged-image-title-container {
    position: absolute;
    top: 10px;
    left: 10px;
    display: flex;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 5px;
    padding: 5px;
    overflow: hidden;
  }

  .enlarged-image-text {
    flex-grow: 1;
    padding: 0 10px;
    overflow: hidden;
  }

  .enlarged-image-title {
    color: white;
    font-size: 16px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .enlarged-image-subtitle {
    color: #ccc;
    font-size: 14px;
    margin: 5px 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .enlarged-image-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    border-radius: 10px;
  }

  /* Enlarged Image View Buttons */
  .close-button,
  .download-button {
    position: absolute;
    top: 10px;
    z-index: 2;
  }

  .close-button {
    right: 10px;
  }

  .download-button {
    right: 60px;
  }

  .enlarged-image-container .icon-button:hover {
    background-color: rgba(0, 0, 0, 0.8);
    color: rgba(255, 255, 255, 1);
  }

  /* Zoom Controls */
  .zoom-controls {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: rgba(0, 0, 0, 0.3);
    padding: 5px;
    border-radius: 25px;
    z-index: 2;
  }

  .image-counter {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    min-width: 60px;
    text-align: center;
  }

  .zoom-info {
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    min-width: 60px;
    text-align: center;
  }

  .zoom-button,
  .reset-zoom-button {
    background-color: rgba(0, 0, 0, 0.5);
    width: 40px;
    height: 40px;
  }

  /* Loading Spinner */
  .loading-spinner-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #1a1a1a;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 5px solid #f3f3f3;
    border-top: 5px solid #61dafb;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  /* Error Display */
  .error {
    color: #ff6b6b;
    margin-top: 20px;
    text-align: left;
    background-color: rgba(255, 107, 107, 0.1);
    border: 1px solid #ff6b6b;
    border-radius: 5px;
    padding: 15px;
  }

  .error-header {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }

  .error-header i {
    margin-right: 10px;
    font-size: 20px;
  }

  .error-header p {
    margin: 0;
    font-weight: bold;
  }

  .error-divider {
    border: none;
    border-top: 1px solid #ff6b6b;
    margin: 10px 0;
  }

  .error-message {
    margin: 5px 0;
    font-size: 15px;
  }

  /* Error Link */
  .error-link {
    color: #61dafb;
    text-decoration: none;
    margin-left: 5px;
  }

  .error-link:hover {
    text-decoration: underline;
  }
    
  /* Animations */
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes rainbow-colors {
    0% { color: #ff0000; }
    14% { color: #ff7f00; }
    28% { color: #ffff00; }
    42% { color: #00ff00; }
    57% { color: #0000ff; }
    71% { color: #8b00ff; }
    85% { color: #ff00ff; }
    100% { color: #ff0000; }
  }

  /* Drop Zone Styles */
  .drop-zone {
    min-height: 200px;
    border: 2px dashed #555;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 20px 0;
    transition: all 0.3s ease;
    background-color: rgba(97, 218, 251, 0.05);
    position: relative;
    cursor: pointer;
    margin-bottom: 20px;
    font-size: 15px;
  }

  .drop-zone.dragging {
    border-color: #61dafb;
    background-color: rgba(97, 218, 251, 0.1);
  }

  .drop-zone.has-file {
    background-color: transparent;
    border-style: solid;
    min-height: auto;
  }

  .drop-zone-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #999;
  }

  .drop-zone-content i {
    font-size: 48px;
    color: #61dafb;
  }

  .drop-zone-content p {
    margin: 0;
  }

  .preview-wrapper {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px;
  }

  .preview-image-container {
    max-width: 300px;
    max-height: 300px;
    border: 2px solid #555;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.2);
  }

  .preview-image {
    max-width: 100%;
    max-height: 300px;
    object-fit: contain;
  }

  .file-info {
    color: #999;
    font-size: 14px;
    text-align: center;
  }

  .upload-button {
    background-color: #61dafb;
    color: #1a1a1a;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
    font-size: 15px;
    transition: background-color 0.3s;
  }

  .upload-button:hover {
    background-color: #4fa8d5;
  }

  .clear-button {
    background-color: #ff6b6b;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.3s;
    display: flex;
    align-items: center;
    font-size: 14px;
  }

  .clear-button:hover {
    background-color: #ff5252;
  }

  .clear-button i {
    font-size: 14px;
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hidden-input {
    display: none;
  }

  /* Upscaled Result Styles */
  .upscaled-result {
    text-align: center;
  }

  .resolution-info {
    color: #999;
    font-size: 14px;
    margin-top: 10px;
  }

  /* Upscale Button */
  .upscale-button {
    width: 100%;
    padding: 12px 24px;
    font-size: 15px;
    font-weight: bold;
    background-color: #61dafb;
    color: #1a1a1a;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .upscale-button:hover:not(:disabled) {
    background-color: #4fa8d5;
  }

  .upscale-button:disabled {
    background-color: #2c3e50;
    color: #95a5a6;
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
