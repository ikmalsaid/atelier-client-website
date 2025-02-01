// ===============================
// React Imports and Constants
// ===============================
const { useState, useEffect } = React;

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
  .catch(error => {
    console.error('Error:', error);
  });
}

// ===============================
// UI Components
// ===============================
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

function LoadingSpinner() {
  return (
    <div className="loading-spinner-container">
      <div className="loading-spinner"></div>
    </div>
  );
}

// ===============================
// Helper Functions
// ===============================
const formatDate = (dateString) => {
  if (!dateString || dateString === 'Invalid Date') {
    return 'Invalid Date';
  }
  return dateString;
};

const getColumnIndex = (key) => {
  const indices = {
    'type': 0,
    'task': 1,
    'status': 3,
    'date': 4
  };
  return indices[key];
};

// ===============================
// Main UserHistory Component
// ===============================
function UserHistory() {
  // State declarations
  const [username, setUsername] = useState('');
  const [credits, setCredits] = useState(0);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [menuItems, setMenuItems] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const dropdownRef = React.useRef(null);

  // Data fetching and initialization
  useEffect(() => {
    fetch('/v1/user/info')
      .then(response => response.json())
      .then(data => {
        setUsername(data.username);
        setCredits(data.credits);
      });

    fetch('/v1/presets/menu')
      .then(response => response.json())
      .then(data => setMenuItems(data.menu_items))
      .catch(error => console.error('Error fetching menu items:', error));

    fetch('/v1/user/history')
      .then(response => response.json())
      .then(data => {
        const sortedData = [...data.history].sort((a, b) => {
          const [dateA, timeA] = a[getColumnIndex('date')].split(' ');
          const [dayA, monthA, yearA] = dateA.split('/');
          const dateObjA = new Date(`${yearA}-${monthA}-${dayA} ${timeA}`);

          const [dateB, timeB] = b[getColumnIndex('date')].split(' ');
          const [dayB, monthB, yearB] = dateB.split('/');
          const dateObjB = new Date(`${yearB}-${monthB}-${dayB} ${timeB}`);

          return dateObjB - dateObjA;
        });
        setHistory(sortedData);
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching user history:', error);
        setIsLoading(false);
      });

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

  // Event handlers
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handlePreviewPosition = (event, index) => {
    const preview = event.currentTarget.nextElementSibling;
    const rect = event.currentTarget.getBoundingClientRect();
    
    // Pre-load image and get dimensions before showing preview
    const img = preview.querySelector('img');
    
    // Set initial state
    preview.style.visibility = 'hidden';
    preview.style.display = 'block';
    preview.style.opacity = '0';
    
    // Function to position preview after image is loaded
    const positionPreview = () => {
      const previewRect = preview.getBoundingClientRect();
      let left, top;

      // Check horizontal position
      if (rect.left - previewRect.width - 10 < 0) {
        // Not enough space on the left, position to the right
        left = Math.min(rect.right + 10, window.innerWidth - previewRect.width);
      } else {
        // Position to the left
        left = Math.max(rect.left - previewRect.width - 10, 0);
      }

      // Check vertical position
      top = rect.top + rect.height / 2 - previewRect.height / 2;
      if (top < 0) {
        top = 0;
      } else if (top + previewRect.height > window.innerHeight) {
        top = window.innerHeight - previewRect.height;
      }

      // Apply calculated position
      preview.style.left = `${left}px`;
      preview.style.top = `${top}px`;
      preview.style.visibility = 'visible';
      preview.style.opacity = '1';
    };

    // If image is already loaded and complete
    if (img.complete) {
      positionPreview();
    } else {
      // Wait for image to load before positioning
      img.onload = positionPreview;
    }
  };

  const handlePreviewHide = (event) => {
    const preview = event.currentTarget.nextElementSibling;
    preview.style.opacity = '0';
    preview.style.display = 'none';
  };

  // Rendering helper functions
  const renderDownloadLink = (resultUrl, index) => {
    if (resultUrl) {
      return (
        <div className="download-container">
          <a 
            href={resultUrl} 
            download 
            className="download-link" 
            onMouseEnter={(e) => handlePreviewPosition(e, index)}
            onMouseLeave={handlePreviewHide}
          >
            <i className="fas fa-download"></i> Download
          </a>
          <div className="image-preview">
            <img 
              src={resultUrl} 
              alt="Preview" 
              loading="lazy"
              decoding="async"
              crossOrigin="anonymous"
              onLoad={(e) => {
                const img = e.target;
                if (img.complete) {
                  const lastModified = img.getAttribute('data-last-modified');
                  if (lastModified) {
                    img.setAttribute('cache-control', 'public, max-age=31536000');
                    img.setAttribute('expires', new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString());
                  }
                }
              }}
              onError={(e) => {
                console.error('Error loading image:', e);
                e.target.style.display = 'none';
              }}
            />
          </div>
        </div>
      );
    }
    return null;
  };

  const renderTaskAndDetail = (task, detail) => (
    <div className="task-detail-container">
      <div className="task">{task}</div>
      {detail && <div className="detail">{detail}</div>}
    </div>
  );

  // Sorting and pagination logic
  const sortData = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    
    const sortedData = [...history].sort((a, b) => {
      let aValue = a[getColumnIndex(key)];
      let bValue = b[getColumnIndex(key)];
      
      if (key === 'date') {
        const [dateA, timeA] = aValue.split(' ');
        const [dayA, monthA, yearA] = dateA.split('/');
        const dateObjA = new Date(`${yearA}-${monthA}-${dayA} ${timeA}`);

        const [dateB, timeB] = bValue.split(' ');
        const [dayB, monthB, yearB] = dateB.split('/');
        const dateObjB = new Date(`${yearB}-${monthB}-${dayB} ${timeB}`);

        return direction === 'asc' ? dateObjA - dateObjB : dateObjB - dateObjA;
      }
      
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    setHistory(sortedData);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = history.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(history.length / itemsPerPage);

  // Pagination component
  const Pagination = () => (
    <div className="pagination">
      <div className="pagination-info">
        Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, history.length)} of {history.length} results
      </div>
      <div className="pagination-controls">
        <button 
          onClick={() => setCurrentPage(1)} 
          disabled={currentPage === 1}
        >
          &lt;&lt;
        </button>
        <button 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          &lt;
        </button>
        <span className="page-info">Page {currentPage} of {totalPages}</span>
        <button 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          &gt;
        </button>
        <button 
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          &gt;&gt;
        </button>
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Main render
  return (
    <div className="container">
      {/* Header Section */}
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

      {/* Title and Copyright */}
      <RainbowText text={`History for ${username}`} isAnimating={false} />
      <div className="copyright">Copyright (C) 2025 Ikmal Said. All rights reserved</div>

      {/* History List */}
      <div className="history-list">
        {history.length > 0 ? (
          <React.Fragment>
            <ul>
              <li className="history-header">
                <span className="history-number">#</span>
                <span 
                  className="history-type sortable"
                  onClick={() => sortData('type')}
                >
                  Type {sortConfig.key === 'type' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
                <span 
                  className="history-task-detail sortable"
                  onClick={() => sortData('task')}
                >
                  Task {sortConfig.key === 'task' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
                <span 
                  className="history-status sortable"
                  onClick={() => sortData('status')}
                >
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
                <span 
                  className="history-date sortable"
                  onClick={() => sortData('date')}
                >
                  Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </span>
                <span className="history-download">Download</span>
              </li>
              {currentItems.map((item, index) => (
                <li key={index} className="history-item">
                  <span className="history-number">{indexOfFirstItem + index + 1}.</span>
                  <span className="history-type">{item[0]}</span>
                  <span className="history-task-detail">
                    {renderTaskAndDetail(item[1], item[2])}
                  </span>
                  <span className={`history-status ${item[3]}`}>{item[3]}</span>
                  <span className="history-date">{formatDate(item[4])}</span>
                  <span className="history-download">{renderDownloadLink(item[5], index)}</span>
                </li>
              ))}
            </ul>
            <Pagination />
          </React.Fragment>
        ) : (
          <p className="no-history">Nothing to see here.</p>
        )}
      </div>
    </div>
  );
}

// ===============================
// App Initialization
// ===============================
ReactDOM.render(
  <React.StrictMode>
    <UserHistory />
  </React.StrictMode>,
  document.getElementById('root')
);

// ===============================
// Styles
// ===============================
const styles = `
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css');
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
  .container {
    max-width: 100%;
    margin: 0 auto;
    padding: 20px;
    padding-top: 40px;
    overflow-x: hidden;
  }
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
  select {
    font-size: 16px;
    background-color: #333;
    color: #fff;
    border: none;
    border-left: 1px solid #555;
    cursor: pointer;
    outline: none;
    padding: 10px 40px 10px 10px;  // Increased right padding to 40px
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
    background-repeat: no-repeat;
    background-position: right 10px center;
  }
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
  .user-info a, .dropbtn {
    color: #61dafb;
    text-decoration: none;
    transition: color 0.3s;
  }
  .user-info a:hover, .dropbtn:hover {
    color: #4fa8d5;
  }
  .container {
    padding-top: 40px;
  }
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
    display: block;
    position: absolute;
    background-color: #444;
    min-width: 160px;
    box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
    z-index: 1;
    border-radius: 4px;
    overflow: hidden;
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
  .dropdown-content {
    display: none;
  }
  .dropdown-content.show {
    display: block;
  }
  input, select, button {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
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
  .copyright {
    text-align: center;
    font-size: 12px;
    color: #666;
    margin-top: -20px;
    margin-bottom: 20px;
    opacity: 0.7;
  }
  .history-list {
    background-color: #333;
    border-radius: 8px;
    padding: 0;
    width: 95%;
    max-width: 1500px;
    margin: 0 auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .history-list ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
    width: 100%;
    display: table;
    border-collapse: separate;
    border-spacing: 0;
    border-radius: 8px;
    overflow: hidden;
  }
  .history-item {
    display: table-row;
    border-bottom: 1px solid #444;
  }
  .history-item > span {
    display: table-cell;
    padding: 15px 25px;
    vertical-align: middle;
    position: relative;
  }
  .history-item:not(:last-child) > span {
    border-bottom: 10px solid #333;
  }
  .history-item > span:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 10%;
    height: 80%;
    width: 1px;
    background-color: rgba(255, 255, 255, 0.1);
  }
  .history-item > span:not(:last-child) {
    padding-right: 10px;
    padding-left: 10px;
  }
  .history-number {
    width: 30px;
    text-align: center;
    padding-right: 10px !important;
  }
  .history-type {
    font-weight: bold;
    color: #61dafb;
    width: 120px;
    white-space: nowrap;
    text-align: center;
  }
  .history-task-detail {
    width: auto;
    white-space: normal;
    word-break: break-word;
  }
  .history-status {
    width: 80px;
    text-align: center;
    padding: 2px 5px;
    border-radius: 3px;
    white-space: nowrap;
    font-weight: bold;
    text-transform: uppercase;
  }
  .history-status.success {
    color: #28a745;
  }
  .history-status.failed {
    color: #dc3545;
  }
  .history-date {
    color: #999;
    font-size: 0.9em;
    width: 180px;
    text-align: center;
    white-space: nowrap;
  }
  .no-history {
    text-align: center;
    color: #666;
    margin-top: 20px;
    padding: 10px;
    font-size: 15px;
  }
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
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .history-download {
    width: 100px;
    text-align: center;
  }

  .download-link {
    color: #61dafb;
    text-decoration: none;
    font-size: 0.9em;
    transition: color 0.3s;
  }

  .download-link:hover {
    color: #4fa8d5;
  }

  .download-link i {
    margin-right: 5px;
  }

  .download-container {
    position: relative;
    display: inline-block;
  }

  .image-preview {
    position: fixed;
    background-color: #444;
    padding: 5px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    z-index: 9999;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease-in-out;
    pointer-events: none;
  }

  .image-preview img {
    max-width: 200px;
    max-height: 200px;
    display: block;
    opacity: 1;
  }

  .download-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .download-link {
    position: relative;
    z-index: 1;
  }

  .task-detail-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
  }

  .task {
    font-weight: bold;
    margin-bottom: 5px;
  }

  .detail {
    font-size: 0.9em;
    color: #999;
  }

  .history-task-detail {
    width: auto;
    white-space: normal;
    word-break: break-word;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }
  
  .sortable:hover {
    color: #61dafb;
  }
  
  .history-header {
    display: table-row;
    background-color: #2a2a2a;
    font-weight: bold;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  .history-header > span {
    display: table-cell;
    padding: 15px;
    border-bottom: 2px solid #444;
    text-transform: uppercase;
    font-size: 0.85em;
    letter-spacing: 0.5px;
    color: white;
    background-color: #2a2a2a;
  }
  
  .history-header > span:first-child {
    border-top-left-radius: 8px;
  }
  
  .history-header > span:last-child {
    border-top-right-radius: 8px;
  }
  
  .pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background-color: #2a2a2a;
    border-top: 1px solid #444;
    font-size: 0.9em;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
  
  .pagination-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  
  .pagination-controls button {
    background-color: #444;
    border: none;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.9em;
    min-width: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .pagination-controls button:disabled {
    background-color: #333;
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  .pagination-controls button:hover:not(:disabled) {
    background-color: #555;
    transform: translateY(-1px);
  }
  
  .pagination-controls button:active:not(:disabled) {
    transform: translateY(0);
  }
  
  .page-info {
    margin: 0 15px;
    color: #999;
    font-size: 0.9em;
    white-space: nowrap;
  }
  
  .pagination-info {
    color: #999;
    font-size: 0.9em;
    background-color: #383838;
    padding: 6px 12px;
    border-radius: 4px;
    white-space: nowrap;
  }
  
  .history-item {
    transition: background-color 0.2s ease;
  }
  
  .history-item:hover {
    background-color: #383838;
  }
  
  .history-item > span {
    padding: 12px 15px;
  }
  
  .history-status {
    font-size: 0.85em;
    letter-spacing: 0.5px;
    padding: 4px 8px;
    border-radius: 4px;
  }
  
  .history-status.success {
    color: #28a745;
  }
  
  .history-status.failed {
    color: #dc3545;
  }
  
  .download-link {
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }
  
  .download-link:hover {
    background-color: rgba(97, 218, 251, 0.1);
  }
  
  .task-detail-container {
    padding: 4px 0;
  }
  
  .task {
    color: #fff;
    margin-bottom: 4px;
  }
  
  .detail {
    font-size: 0.85em;
    color: #888;
    line-height: 1.4;
  }
  
  @media (max-width: 768px) {
    .pagination {
      flex-direction: column;
      gap: 10px;
    }
  
    .pagination-info {
      order: 2;
    }
  
    .pagination-controls {
      order: 1;
      width: 100%;
      justify-content: center;
    }
  }

    .history-download {
    width: 100px;
    text-align: center;
  }

  .download-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }

  .image-preview {
    display: none;
    position: fixed;
    background-color: #444;
    padding: 5px;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0,0,0,0.5);
    z-index: 9999;  // Increased z-index
    opacity: 0;
    transition: opacity 0.1s ease-in-out;
    pointer-events: none;  // Added to prevent mouse interaction with preview
  }

  .image-preview img {
    max-width: 200px;
    max-height: 200px;
    display: block;
  }

  .download-container:hover .image-preview {
    display: block;
    opacity: 1;
  }

  .download-link {
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #61dafb;
    text-decoration: none;
    font-size: 14px;
  }

  .download-link:hover {
    background-color: rgba(97, 218, 251, 0.1);
    color: #61dafb;
  }

  .download-link i {
    margin-right: 5px;
  }

  .pagination {
    position: relative;
    z-index: 1;
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
