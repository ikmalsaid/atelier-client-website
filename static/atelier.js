// ===============================
// Constants and Configurations
// ===============================
const { useState, useEffect, useRef, useImperativeHandle } = React;
const Quantity = Array.from({ length: 3 }, (_, i) => ({
  value: i + 1,
  label: `${i + 1} ${i + 1 === 1 ? 'Image' : 'Images'}`
}));

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

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
    </div>
  );
}

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

// ===============================
// Gallery Components
// ===============================

// Image Gallery Component
function ImageGallery({ images, onDownload, onEnlarge }) {
  const getImagePath = (url) => {
    try {
      return new URL(url).pathname;
    } catch (e) {
      console.error("Invalid URL:", url);
      return url;
    }
  };

  return (
    <div className="gallery">
      {images.map((image, index) => (
        <div key={index} className="image-container">
            <img
              src={getImagePath(image.url)}
              className="thumbnail"
              alt={`Image ${index + 1}`}
              loading="lazy"
              decoding="async"
              crossOrigin="anonymous"
            />
          <div className="image-overlay">
            <button onClick={() => onDownload(getImagePath(image.url), `image_${index + 1}.png`)} className="icon-button" title="Download image">
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
const EnlargedImage = React.forwardRef(({ images, currentIndex, onClose, onNavigate, onDownload, totalImages }, ref) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showCopyTick, setShowCopyTick] = useState(false);
  const [textWidth, setTextWidth] = useState(0);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  React.useImperativeHandle(ref, () => ({
    resetView: () => {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }));

  const handleZoom = (delta, shouldResetPosition = false) => {
    const newScale = Math.min(Math.max(0.75, scale + delta), 3);
    setScale(newScale);
    
    if (shouldResetPosition || newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
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
      setTextWidth(newWidth * 0.7);
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

  const copyPrompt = () => {
    navigator.clipboard.writeText(images[currentIndex].prompt)
      .then(() => {
        setShowCopyTick(true);
        setTimeout(() => setShowCopyTick(false), 2000);
      })
      .catch(err => console.error('Failed to copy prompt: ', err));
  };

  const getImagePath = (url) => {
    try {
      return new URL(url).pathname;
    } catch (e) {
      console.error("Invalid URL:", url);
      return url;
    }
  };

  const formatCreationTime = (timeString) => {
    return timeString;
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
            src={getImagePath(images[currentIndex].url)}
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
            <h2 className="enlarged-image-title">{truncatePrompt(images[currentIndex].prompt)}</h2>
            <p className="enlarged-image-subtitle">
              Style: {images[currentIndex].style} | 
              Model: {images[currentIndex].model} | 
              Size: {images[currentIndex].size} |
              Seed: {images[currentIndex].seed} |
              Created: {formatCreationTime(images[currentIndex].createdAt)}
            </p>
          </div>
          <button onClick={copyPrompt} className="icon-button copy-button" title="Copy prompt">
            <i className={`fas ${showCopyTick ? 'fa-check' : 'fa-copy'}`}></i>
          </button>
        </div>
        <button onClick={onClose} className="icon-button close-button" style={{ zIndex: 2 }} title="Close">
          <i className="fas fa-times"></i>
        </button>
        <button onClick={() => onDownload(getImagePath(images[currentIndex].url), `image_${currentIndex + 1}.png`)} className="icon-button download-button" style={{ zIndex: 2 }} title="Download image">
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
          onClick={() => onNavigate('prev')} 
          className="icon-button nav-button prev-button"
          disabled={currentIndex === 0}
          style={{ zIndex: 2 }}
          title="Previous image"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button 
          onClick={() => onNavigate('next')} 
          className="icon-button nav-button next-button"
          disabled={currentIndex === totalImages - 1}
          style={{ zIndex: 2 }}
          title="Next image"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </div>
    </div>
  );
});

// ===============================
// Main Generator Component
// ===============================
function Generator() {
  const [username, setUsername] = useState('');
  const [credits, setCredits] = useState(0);
  const [menuItems, setMenuItems] = useState({});
  const [prompt, setPrompt] = useState(() => sessionStorage.getItem('atelier_prompt') || '');
  const [images, setImages] = useState(() => {
    try {
      const savedImages = sessionStorage.getItem('atelier_images');
      return savedImages ? JSON.parse(savedImages) : [];
    } catch (error) {
      console.error('Error parsing saved images:', error);
      return [];
    }
  });
  const [error, setError] = useState(null);
  const [enlargedImageIndex, setEnlargedImageIndex] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [size, setSize] = useState(() => sessionStorage.getItem('atelier_size') || '1:1');
  const [model, setModel] = useState(() => sessionStorage.getItem('atelier_model') || 'Flux.1 S');
  const [style, setStyle] = useState(() => sessionStorage.getItem('atelier_style') || 'None');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef(null);
  const [textareaHeight, setTextareaHeight] = useState('auto');
  const textareaRef = React.useRef(null);
  const [quantity, setQuantity] = useState(() => parseInt(sessionStorage.getItem('atelier_quantity')) || 1);
  const [sizeOptions, setSizeOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);
  const [styleOptions, setStyleOptions] = useState([]);
  const [costs, setCosts] = useState(null);
  const enlargedImageRef = React.useRef(null);
  const [negativePrompt, setNegativePrompt] = useState(() => sessionStorage.getItem('atelier_negative_prompt') || '');
  const negativeTextareaRef = React.useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [seed, setSeed] = useState(() => sessionStorage.getItem('atelier_seed') || '');

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

  const adjustTextareaHeight = () => {
    [textareaRef, negativeTextareaRef].forEach(ref => {
      if (ref.current) {
        ref.current.style.height = 'auto';
        ref.current.style.height = `${ref.current.scrollHeight}px`;
      }
    });
  };

  useEffect(() => {
    setTimeout(adjustTextareaHeight, 0);
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt, negativePrompt]);

  const handleTextareaChange = (e) => {
    setPrompt(e.target.value);
  };

  const handleNegativeTextareaChange = (e) => {
    setNegativePrompt(e.target.value);
  };

  useEffect(() => {
    fetch('/v1/user/info')
      .then(response => response.json())
      .then(data => {
        setUsername(data.username);
        setCredits(data.credits);
      })
      .catch(error => console.error('Error fetching user info:', error));

    fetch('/v1/presets/menu')
      .then(response => response.json())
      .then(data => setMenuItems(data.menu_items))
      .catch(error => console.error('Error fetching menu items:', error));

    fetch('/v1/presets/atelier/sizes')
      .then(response => response.json())
      .then(data => setSizeOptions(data.sizes))
      .catch(error => console.error('Error fetching sizes:', error));

    fetch('/v1/presets/atelier/models')
      .then(response => response.json())
      .then(data => setModelOptions(data.models))
      .catch(error => console.error('Error fetching models:', error));

    fetch('/v1/presets/styles')
      .then(response => response.json())
      .then(data => setStyleOptions(data.styles))
      .catch(error => console.error('Error fetching styles:', error));

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
    setIsLoading(false);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    // Simulate some initialization process
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const updateSessionStorage = (key, value) => {
    try {
      if (value === null || value === undefined) {
        sessionStorage.removeItem(`atelier_${key}`);
      } else {
        const serializedValue = typeof value === 'object' ? JSON.stringify(value) : value.toString();
        sessionStorage.setItem(`atelier_${key}`, serializedValue);
      }
    } catch (error) {
      console.error(`Error updating session storage for key atelier_${key}:`, error);
    }
  };

  useEffect(() => {
    try {
      if (prompt) updateSessionStorage('prompt', prompt);
      if (negativePrompt) updateSessionStorage('negative_prompt', negativePrompt);
      if (images.length > 0) updateSessionStorage('images', images);
      if (size) updateSessionStorage('size', size);
      if (model) updateSessionStorage('model', model);
      if (style) updateSessionStorage('style', style);
      if (quantity) updateSessionStorage('quantity', quantity);
      if (seed) updateSessionStorage('seed', seed);
    } catch (error) {
      console.error('Error updating session storage:', error);
    }
  }, [prompt, negativePrompt, images, size, model, style, quantity, seed]);

  useEffect(() => {
    return () => {
      try {
        const storedImages = sessionStorage.getItem('atelier_images');
        if (storedImages) {
          const parsedImages = JSON.parse(storedImages);
          if (!Array.isArray(parsedImages)) {
            console.warn('Invalid images in storage, clearing...');
            sessionStorage.removeItem('atelier_images');
          }
        }
      } catch (error) {
        console.error('Error during cleanup:', error);
        sessionStorage.removeItem('atelier_images');
      }
    };
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  const generateImages = async () => {
    if (!prompt.trim()) {
      setError('A prompt is required. Please enter a prompt before generating images.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    let errorCount = 0;
    let newImages = [...images];

    try {
        const response = await fetch('/v1/user/info');
        const data = await response.json();
        const costPerImage = costs && costs.atelier;
        const totalCost = costPerImage * quantity;
        
        if (data.credits < totalCost) {
            const neededCredits = totalCost - data.credits;
            throw new Error(
              `Insufficient credits. You need ${totalCost} credits but only have ${data.credits}.\n` +
              `You need ${neededCredits} more credits to generate ${quantity} image${quantity > 1 ? 's' : ''}.\n` +
              `Visit the Topup page to purchase more credits.`
            );
        }

        const generateSingleImage = async (index) => {
            try {
                const formData = new FormData();
                formData.append('prompt', prompt.trim());
                formData.append('negative_prompt', negativePrompt.trim());
                formData.append('size', size);
                formData.append('model', model);
                formData.append('style', style);
                formData.append('quantity', quantity);
                if (seed.trim()) formData.append('seed', seed.trim());

                const response = await fetch('/v1/atelier/generate', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.image_url) {
                    const newImage = {
                        url: data.image_url,
                        prompt: prompt.trim(),
                        size,
                        model,
                        style,
                        seed: data.seed,
                        createdAt: data.timestamp
                    };
                    newImages = [newImage, ...newImages];
                    setImages(newImages);
                    setCredits(data.credits);
                    
                    updateSessionStorage('images', newImages);
                } else {
                    throw new Error('No image URL received from server.');
                }
            } catch (error) {
                console.error(`Error generating image ${index + 1}:`, error);
                errorCount++;
                setError(prevError => {
                    const newError = `Error (${errorCount} of ${quantity}): ${error.message}`;
                    return prevError ? `${prevError}\n${newError}` : newError;
                });
            }
        };

        await Promise.all(Array(quantity).fill().map((_, i) => generateSingleImage(i)));
    } catch (error) {
        setError(error.message);
    } finally {
        setIsGenerating(false);
    }
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

  const closeEnlargedImage = () => {
    setEnlargedImageIndex(null);
  };

  const navigateEnlargedImage = (direction) => {
    setEnlargedImageIndex(prevIndex => {
      if (direction === 'prev' && prevIndex > 0) {
        return prevIndex - 1;
      } else if (direction === 'next' && prevIndex < images.length - 1) {
        return prevIndex + 1;
      }
      return prevIndex;
    });
  };

  const handleSeedChange = (e) => {
    const newValue = e.target.value.replace(/[^0-9]/g, '');
    setSeed(newValue);
    if (newValue === '') {
      sessionStorage.removeItem('atelier_seed');
    } else {
      sessionStorage.setItem('atelier_seed', newValue);
    }
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
      <div className="content">
        <RainbowText text="Atelier Atelier Gen" isAnimating={isGenerating} />
        <div className="copyright">© 2023-2024 Ikmal Said</div>
        <div className="input-group">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={handleTextareaChange}
            placeholder="Enter your prompt (required)"
            rows={1}
            style={{ height: textareaHeight }}
            required
          />
          <textarea
            ref={negativeTextareaRef}
            value={negativePrompt}
            onChange={handleNegativeTextareaChange}
            placeholder="Enter negative prompt (optional)"
            rows={1}
            style={{ height: textareaHeight, marginTop: '10px' }}
          />
        </div>
        <div className="controls-group">
          <div className="select-container">
            <div className="control-label">Style</div>
            <select value={style} onChange={(e) => setStyle(e.target.value)}>
              {styleOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="select-container">
            <div className="control-label">Model</div>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {modelOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="select-container">
            <div className="control-label">Size</div>
            <select value={size} onChange={(e) => setSize(e.target.value)}>
              {sizeOptions.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
          <div className="select-container">
            <div className="control-label">Quantity</div>
            <select value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))}>
              {Quantity.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="select-container">
            <div className="control-label">Seed</div>
            <input
              type="text"
              value={seed}
              onChange={handleSeedChange}
              placeholder="Seed (optional)"
              className="seed-input"
            />
          </div>
        </div>
        <button onClick={generateImages} disabled={isGenerating} className="generate-button">
          {isGenerating ? (
            <React.Fragment>
              <i className="fas fa-gear fa-spin" style={{ marginRight: '8px' }} />
              Generating... (Do not leave or refresh the page!)
            </React.Fragment>
          ) : 'Generate'}
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
      </div>
      
      {images.length > 0 && <hr className="gallery-divider" />}
      
      <div className="scrollable-gallery">
        <ImageGallery 
          images={images} 
          onDownload={downloadImage} 
          onEnlarge={enlargeImage} 
        />
      </div>
      {enlargedImageIndex !== null && (
        <EnlargedImage 
          images={images} 
          currentIndex={enlargedImageIndex}
          totalImages={images.length}
          onClose={closeEnlargedImage} 
          onNavigate={(direction) => {
            navigateEnlargedImage(direction);
            if (enlargedImageRef.current) {
              enlargedImageRef.current.resetView();
            }
          }}
          onDownload={downloadImage}
          ref={enlargedImageRef}
        />
      )}
      
      {showScrollTop && (
        <button 
          className="scroll-top-button" 
          onClick={scrollToTop}
          title="Back to Top"
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
    <ErrorBoundary>
      <Generator />
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

  /* Input Controls */
  .input-group {
    margin-bottom: 10px;
  }

  .input-group textarea {
    width: 100%;
    border-radius: 5px;
    resize: none;
    overflow: hidden;
    min-height: 42px;
    padding: 10px;
    font-size: 15px;
    line-height: 1.2;
    border: 1px solid #555;
    background-color: #333;
    color: #fff;
    outline: none;
    box-sizing: border-box;
  }

  .input-group textarea:hover,
  .input-group textarea:focus {
    border-color: #61dafb;
    box-shadow: none;
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
    padding: 8px 30px 8px 10px;
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

  /* Generate Button */
  .generate-button {
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

  .generate-button:hover:not(:disabled) {
    background-color: #4fa8d5;
  }

  .generate-button:disabled {
    background-color: #2c3e50;
    color: #95a5a6;
    cursor: not-allowed;
    opacity: 0.7;
    transform: none;
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

  /* Error Link */
  .error-link {
    color: #61dafb;
    text-decoration: none;
    margin-left: 5px;
  }

  .error-link:hover {
    text-decoration: underline;
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

  /* Seed Input */
  .seed-input {
    width: 100%;
    padding: 8px 10px;
    font-size: 15px;
    background-color: #333;
    color: #fff;
    border: 1px solid #555;
    border-radius: 5px;
    outline: none;
    box-sizing: border-box;
  }

  .seed-input:hover,
  .seed-input:focus {
    border-color: #61dafb;
  }

  .seed-input::placeholder {
    color: #888;
  }

  /* Control Label */
  .control-label {
    display: flex;
    align-items: center;
    font-size: 10px;
    color: #999;
    margin-bottom: 4px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 1px;
    width: 100%;
    white-space: nowrap;
  }

  .control-label::before {
    content: '';
    flex: 1;
    height: 1px;
    background: #555;
    margin-right: 8px;
  }

  .control-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #555;
    margin-left: 8px;
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

