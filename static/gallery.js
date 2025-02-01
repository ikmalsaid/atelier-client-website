// ===============================
// Constants and Configurations
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

function LoadingSpinner() {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
    </div>
  );
}

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

// Image Gallery Component
function ImageGallery({ images, onDownload, onEnlarge }) {
  return (
    <div className="gallery">
      {images.map((image, index) => (
        <div key={index} className="image-container">
          <img
            src={image[4]}
            className="thumbnail"
            alt={`Image ${index + 1}`}
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
          />
          <div className="image-overlay">
            <button onClick={() => onDownload(image[4], `image_${index + 1}.png`)} className="icon-button" title="Download image">
              <i className="fas fa-download"></i>
            </button>
            <button onClick={() => onEnlarge(index)} className="icon-button" title="Enlarge image">
              <i className="fas fa-search-plus"></i>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Enlarged Image Component
const EnlargedImage = React.forwardRef(({ image, currentIndex, onClose, onNavigate, onDownload, totalImages }, ref) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showCopyTick, setShowCopyTick] = useState(false);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const [textWidth, setTextWidth] = useState(0);

  React.useImperativeHandle(ref, () => ({
    resetView: () => {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }));

  const handleZoom = (delta) => {
    const newScale = Math.min(Math.max(0.75, scale + delta), 3);
    setScale(newScale);
    if (newScale === 1) setPosition({ x: 0, y: 0 });
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

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
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
    const handleResize = () => {
      const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
      const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
      const newWidth = vw * 0.9;
      const newHeight = vh * 0.9;
      setDimensions({
        width: newWidth,
        height: newHeight
      });
      setTextWidth(newWidth * 0.7);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const wrapperRef = useRef(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const handleWheelEvent = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        handleZoom(delta);
      };

      wrapper.addEventListener('wheel', handleWheelEvent, { passive: false });
      return () => wrapper.removeEventListener('wheel', handleWheelEvent);
    }
  }, [scale]);

  const copyPrompt = (prompt) => {
    navigator.clipboard.writeText(prompt)
      .then(() => {
        setShowCopyTick(true);
        setTimeout(() => setShowCopyTick(false), 2000);
      })
      .catch(err => console.error('Failed to copy prompt: ', err));
  };

  const truncatePrompt = (prompt) => {
    return prompt.length > 80 ? prompt.substring(0, 77) + '...' : prompt;
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
            src={image[4]}
            alt="Enlarged image"
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

        <div className="enlarged-image-title-container" style={{ maxWidth: textWidth, zIndex: 2 }}>
          <div className="enlarged-image-text">
            <h2 className="enlarged-image-title">{truncatePrompt(image[1])}</h2>
            <p className="enlarged-image-subtitle">
              {image[2]} |
              Created: {image[3]}
            </p>
          </div>
          <button onClick={() => copyPrompt(image[1])} className="icon-button copy-button" title="Copy prompt">
            <i className={`fas ${showCopyTick ? 'fa-check' : 'fa-copy'}`}></i>
          </button>
        </div>

        <button onClick={onClose} className="icon-button close-button" title="Close">
          <i className="fas fa-times"></i>
        </button>
        
        <button onClick={() => onDownload(image[4], 'image.png')} className="icon-button download-button" title="Download image">
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
            {currentIndex + 1} / {totalImages}
          </span>
          <button onClick={() => handleZoom(0.05)} className="icon-button zoom-button" title="Zoom in (5%)">
            <i className="fas fa-search-plus"></i>
          </button>
        </div>

        <button 
          onClick={() => onNavigate(currentIndex - 1)} 
          className="icon-button nav-button prev-button" 
          disabled={currentIndex === 0}
          title="Previous image"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button 
          onClick={() => onNavigate(currentIndex + 1)} 
          className="icon-button nav-button next-button" 
          disabled={currentIndex === totalImages - 1}
          title="Next image"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
});

// Filter Component
function GalleryControls({ onSortChange, onTypeChange, sortBy, filterType, types, typeCounts }) {
  return (
    <div className="gallery-controls">
      <div className="controls-group">
        <div className="select-container">
          <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            <option value="date-desc">Sort by Latest First</option>
            <option value="date-asc">Sort by Oldest First</option>
          </select>
        </div>
        <div className="select-container">
          <select value={filterType} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="all">All Types ({typeCounts.all})</option>
            {types.map((type, index) => (
              <option key={index} value={type}>
                {type} ({typeCounts[type] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// Main Gallery Component
function Gallery() {
  const [username, setUsername] = useState('');
  const [credits, setCredits] = useState(0);
  const [menuItems, setMenuItems] = useState({});
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enlargedImageIndex, setEnlargedImageIndex] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const enlargedImageRef = useRef(null);
  const [sortBy, setSortBy] = useState('date-desc');
  const [filterType, setFilterType] = useState('all');
  const [filteredImages, setFilteredImages] = useState([]);
  const [uniqueTypes, setUniqueTypes] = useState([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [typeCounts, setTypeCounts] = useState({});

  useEffect(() => {
    Promise.all([
      fetch('/v1/user/info').then(res => res.json()),
      fetch('/v1/presets/menu').then(res => res.json()),
      fetch('/v1/user/gallery').then(res => res.json())
    ]).then(([userInfo, menuItems, gallery]) => {
      setUsername(userInfo.username);
      setCredits(userInfo.credits);
      setMenuItems(menuItems.menu_items);
      setImages(gallery.gallery);
      
      // Extract unique types and count occurrences
      const types = [...new Set(gallery.gallery.map(img => img[0]))];
      setUniqueTypes(types);
      
      // Calculate counts for each type
      const counts = gallery.gallery.reduce((acc, img) => {
        acc[img[0]] = (acc[img[0]] || 0) + 1;
        return acc;
      }, {});
      counts.all = gallery.gallery.length; // Add total count
      setTypeCounts(counts);
      
      setIsLoading(false);
    }).catch(error => {
      console.error('Error fetching data:', error);
      setIsLoading(false);
    });

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sort and filter images
  useEffect(() => {
    let sorted = [...images];
    
    // Apply sorting
    switch (sortBy) {
      case 'date-desc':
        sorted.sort((a, b) => {
          // Parse date and time: "DD/MM/YYYY HH:mm:ss"
          const [dateA, timeA] = a[3].split(' ');
          const [dateB, timeB] = b[3].split(' ');
          const [dayA, monthA, yearA] = dateA.split('/');
          const [dayB, monthB, yearB] = dateB.split('/');
          
          // Create Date objects with proper format: "YYYY-MM-DD HH:mm:ss"
          const dateTimeA = new Date(`${yearA}-${monthA}-${dayA} ${timeA}`);
          const dateTimeB = new Date(`${yearB}-${monthB}-${dayB} ${timeB}`);
          
          return dateTimeB - dateTimeA;
        });
        break;
      case 'date-asc':
        sorted.sort((a, b) => {
          // Parse date and time: "DD/MM/YYYY HH:mm:ss"
          const [dateA, timeA] = a[3].split(' ');
          const [dateB, timeB] = b[3].split(' ');
          const [dayA, monthA, yearA] = dateA.split('/');
          const [dayB, monthB, yearB] = dateB.split('/');
          
          // Create Date objects with proper format: "YYYY-MM-DD HH:mm:ss"
          const dateTimeA = new Date(`${yearA}-${monthA}-${dayA} ${timeA}`);
          const dateTimeB = new Date(`${yearB}-${monthB}-${dayB} ${timeB}`);
          
          return dateTimeA - dateTimeB;
        });
        break;
      case 'type':
        sorted.sort((a, b) => a[0].localeCompare(b[0]));
        break;
    }
    
    // Apply filtering
    if (filterType !== 'all') {
      sorted = sorted.filter(img => img[0] === filterType);
    }
    
    setFilteredImages(sorted);
  }, [images, sortBy, filterType]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const downloadImage = (imageUrl, fileName) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const enlargeImage = (index) => {
    setEnlargedImageIndex(index);
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

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

      <div className="content">
        <RainbowText text={`Gallery for ${username}`} isAnimating={false} />
        <div className="copyright">Copyright (C) 2025 Ikmal Said. All rights reserved</div>
        
        <GalleryControls 
          onSortChange={setSortBy}
          onTypeChange={setFilterType}
          sortBy={sortBy}
          filterType={filterType}
          types={uniqueTypes}
          typeCounts={typeCounts}
        />

        {filteredImages.length > 0 ? (
          <React.Fragment>
            <hr className="gallery-divider" />
            <div className="scrollable-gallery">
              <ImageGallery 
                images={filteredImages}
                onDownload={downloadImage}
                onEnlarge={enlargeImage}
              />
            </div>
          </React.Fragment>
        ) : (
          <p className="no-gallery">Nothing to see here.</p>
        )}

        {enlargedImageIndex !== null && (
          <EnlargedImage
            image={filteredImages[enlargedImageIndex]}
            onClose={() => setEnlargedImageIndex(null)}
            onDownload={downloadImage}
            ref={enlargedImageRef}
            currentIndex={enlargedImageIndex}
            totalImages={filteredImages.length}
            onNavigate={(newIndex) => {
              if (newIndex >= 0 && newIndex < filteredImages.length) {
                setEnlargedImageIndex(newIndex);
                if (enlargedImageRef.current) {
                  enlargedImageRef.current.resetView();
                }
              }
            }}
          />
        )}
      </div>

      {showScrollTop && (
        <button 
          className="scroll-top-button" 
          onClick={scrollToTop}
          title="Scroll to top"
        >
          <i className="fas fa-arrow-up"></i>
          <span className="scroll-label">Back to Top</span>
        </button>
      )}

    </div>
  );
}

// ===============================
// App Initialization
// ===============================
ReactDOM.render(
  <React.StrictMode>
    <Gallery />
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
  body, input, select, button, textarea {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  html {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  html::-webkit-scrollbar {
    display: none;
  }

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #1a1a1a;
    color: #ffffff;
    margin: 0;
    padding: 0;
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
    height: 19px;
  }

  /* Dropdown Menu */
  .dropdown {
    position: relative;
    display: inline-block;
  }

  .dropbtn {
    background-color: transparent;
    color: #61dafb;
    padding: 0;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: color 0.3s;
    display: flex;
    align-items: center;
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
    z-index: 1;
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

  .controls-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 15px;
  }

  .select-container {
    flex: 1;
    min-width: 120px;
    position: relative;
  }

  .select-container select {
    width: 100%;
    padding: 10px 30px 10px 10px;
    font-size: 15px;
    background-color: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 5px;
    cursor: pointer;
    outline: none;
    appearance: none;
    background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
    background-repeat: no-repeat;
    background-position: right 5px center;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .select-container select:hover,
  .select-container select:focus {
    border-color: #61dafb;
  }

  /* Gallery Divider */
  .gallery-divider {
    border: none;
    border-top: 1px solid #555;
    margin: 20px 0;
    width: 100%;
  }
  /* Gallery */
  .scrollable-gallery {
    flex-grow: 1;
    overflow-y: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .scrollable-gallery::-webkit-scrollbar {
    width: 0;
    background: transparent;
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 10px;
    padding: 0px 0 40px;
  }

  /* Image Container */
  .image-container {
    position: relative;
    overflow: hidden;
    transform-style: preserve-3d;
    perspective: 1000px;
    border-radius: 5px;
    backface-visibility: hidden;
    will-change: transform;
    border: 1px solid #555;
  }

  .thumbnail {
    width: 100%;
    height: 280px;
    object-fit: cover;
    border-radius: 5px;
    transition: all 0.3s ease;
    transform-origin: center center;
    transform: translateZ(0);
    backface-visibility: hidden;
    will-change: transform;
    display: block;
  }

  .image-container:hover {
    border-color: #61dafb;
  }

  .image-container:hover .thumbnail {
    filter: brightness(0.7);
    transform: scale(1.05) rotate3d(1, 1, 0, 2deg) translateZ(0);
  }

  .image-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transition: opacity 0.3s;
    background-color: transparent;
  }

  .image-container:hover .image-overlay {
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

  /* Buttons */
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

  .copy-button {
    background-color: transparent;
    font-size: 16px;
    width: 30px;
    height: 30px;
  }

  .close-button,
  .download-button {
    position: absolute;
    top: 10px;
  }

  .close-button {
    right: 10px;
  }

  .download-button {
    right: 60px;
  }

  .nav-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 50px;
    height: 50px;
  }

  .nav-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background-color: transparent;
  }

  .prev-button {
    left: 10px;
  }

  .next-button {
    right: 10px;
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

  /* Rainbow Text */
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

  /* Copyright */
  .copyright {
    text-align: center;
    font-size: 12px;
    color: #666;
    margin-top: -20px;
    margin-bottom: 20px;
    opacity: 0.7;
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

  /* Scroll to Top Button */
  .scroll-top-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999;
    background-color: #61dafb;
    border: none;
    border-radius: 10px;
    padding: 12px 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: bold;
  }

  .scroll-top-button i {
    font-size: 16px;
  }

  .no-gallery {
    text-align: center;
    color: #666;
    margin-top: 20px;
    padding: 10px;
    font-size: 15px;
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
