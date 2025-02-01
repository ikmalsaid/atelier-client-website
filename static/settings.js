// ===============================
// React Imports and Constants
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

function validateUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9@._-]{3,20}$/;
  return usernameRegex.test(username);
}

function validatePassword(password) {
  const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,}$/;
  return passwordRegex.test(password);
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
// Main SettingsPage Component
// ===============================
function SettingsPage() {
  // State Management
  const [username, setUsername] = useState('');
  const [credits, setCredits] = useState(0);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [menuItems, setMenuItems] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const dropdownRef = React.useRef(null);
  const messageTimeoutRef = useRef(null);

  // Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('');

  // Add new state for username form
  const [newUsername, setNewUsername] = useState('');
  const [usernamePassword, setUsernamePassword] = useState('');

  // Add separate message state for each section
  const [usernameMessage, setUsernameMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');

  // Add new state variables
  const [clearHistoryPassword, setClearHistoryPassword] = useState('');
  const [downloadGalleryPassword, setDownloadGalleryPassword] = useState('');
  const [clearHistoryMessage, setClearHistoryMessage] = useState('');
  const [downloadMessage, setDownloadMessage] = useState('');

  // Add new state for history status
  const [hasHistory, setHasHistory] = useState(false);

  // Add new state for scroll button
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Add new state variables for confirmation
  const [deleteConfirmClicked, setDeleteConfirmClicked] = useState(false);
  const [clearHistoryConfirmClicked, setClearHistoryConfirmClicked] = useState(false);

  // Add to the SettingsPage component state
  const [recoveryKeyPassword, setRecoveryKeyPassword] = useState('');
  const [recoveryKeyMessage, setRecoveryKeyMessage] = useState('');

  // Update theme state variables
  const [themeColor, setThemeColor] = useState('#61dafb');
  const [themeFont, setThemeFont] = useState('Segoe UI');
  const [themeMessage, setThemeMessage] = useState('');
  const DEFAULT_THEME_COLOR = '#61dafb';
  const DEFAULT_THEME_FONT = 'Segoe UI';

  const AVAILABLE_FONTS = [
    'Segoe UI',
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Impact'
  ];

  // Password Visibility
  const [showPassword, setShowPassword] = useState({
    username: false,
    current: false,
    new: false,
    confirm: false,
    delete: false,
    clear: false,
    download: false,
    recovery: false
  });

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Data Fetching
  useEffect(() => {
    // Fetch user info
    fetch('/v1/user/info')
      .then(response => response.json())
      .then(data => {
        setUsername(data.username);
        setCredits(data.credits);
        setIsLoading(false);
      });

    // Fetch menu items
    fetch('/v1/presets/menu')
      .then(res => res.json())
      .then(data => setMenuItems(data.menu_items))
      .catch(error => console.error('Error fetching menu:', error));

    // Dropdown click outside handler
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    // Check if user has any history
    fetch('/v1/user/history')
      .then(res => res.json())
      .then(data => setHasHistory(data.history.length > 0))
      .catch(error => console.error('Error checking history:', error));

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Event Handlers
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  const handlePasswordUpdate = (e) => {
    e.preventDefault();
    
    // Validate new password
    if (!validatePassword(newPassword)) {
      setPasswordMessage('Try again with a different password!');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match!');
      return;
    }
    
    setIsProcessing(true);
    fetch('/v1/user/password/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        current_password: currentPassword,
        new_password: newPassword 
      }),
    })
    .then(response => response.json())
    .then(data => {
      setPasswordMessage(data.message);
      if (data.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      setPasswordMessage('An error occurred. Please try again.');
    })
    .finally(() => setIsProcessing(false));
  };

  const handleDeleteAccount = (e) => {
    e.preventDefault();
    
    if (!deleteConfirmClicked) {
      setDeleteConfirmClicked(true);
      setTimeout(() => setDeleteConfirmClicked(false), 3000);
      return;
    }

    setIsProcessing(true);
    fetch('/v1/user/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: deleteConfirmPassword }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        clearSessionStorage();
        window.location.href = '/';
      } else {
        setDeleteMessage(data.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      setDeleteMessage('An error occurred. Please try again.');
    })
    .finally(() => {
      setIsProcessing(false);
      setDeleteConfirmClicked(false);
    });
  };

  // Add username update handler
  const handleUsernameUpdate = (e) => {
    e.preventDefault();
    
    // Validate new username
    if (!validateUsername(newUsername)) {
      setUsernameMessage('Try again with a different username!');
      return;
    }
    
    // Prevent updating to the same username
    if (newUsername === username) {
      setUsernameMessage('New username must be different from current username!');
      return;
    }
    
    setIsProcessing(true);
    fetch('/v1/user/username/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        current_password: usernamePassword,
        new_username: newUsername 
      }),
    })
    .then(response => response.json())
    .then(data => {
      setUsernameMessage(data.message);
      if (data.success) {
        setUsername(newUsername);
        setNewUsername('');
        setUsernamePassword('');
      }
    })
    .catch(error => {
      console.error('Error:', error);
      setUsernameMessage('An error occurred. Please try again.');
    })
    .finally(() => setIsProcessing(false));
  };

  // Add new handlers
  const handleClearHistory = (e) => {
    e.preventDefault();
    
    if (!hasHistory) {
      setClearHistoryMessage('No history to clear!');
      return;
    }

    if (!clearHistoryConfirmClicked) {
      setClearHistoryConfirmClicked(true);
      setTimeout(() => setClearHistoryConfirmClicked(false), 3000);
      return;
    }

    setIsProcessing(true);
    fetch('/v1/user/history/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: clearHistoryPassword }),
    })
    .then(response => response.json())
    .then(data => {
      setClearHistoryMessage(data.message);
      if (data.success) {
        clearSessionStorage();
        setClearHistoryPassword('');
        setHasHistory(false);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      setClearHistoryMessage('An error occurred. Please try again.');
    })
    .finally(() => {
      setIsProcessing(false);
      setClearHistoryConfirmClicked(false);
    });
  };

  const handleDownloadGallery = (e) => {
    e.preventDefault();
    setIsProcessing(true);
    fetch('/v1/user/archive/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: downloadGalleryPassword }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setDownloadMessage('Processing your request...');
        window.location.href = `/v1/user/archive/download/${data.download_id}`;
        setDownloadGalleryPassword('');
      } else {
        setDownloadMessage(data.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      setDownloadMessage('An error occurred. Please try again.');
    })
    .finally(() => setIsProcessing(false));
  };

  // Add new handler for recovery key
  const handleGetRecoveryKey = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      const response = await fetch('/v1/user/password/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: recoveryKeyPassword })
      });
      
      const data = await response.json();
      if (data.success) {
        await navigator.clipboard.writeText(data.recovery_key);
        setRecoveryKeyMessage('Recovery key copied to clipboard!');
        setRecoveryKeyPassword('');
      } else {
        setRecoveryKeyMessage(data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      setRecoveryKeyMessage('An error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Update the useEffect for message timeouts
  useEffect(() => {
    const messageStates = [
      { message: usernameMessage, setMessage: setUsernameMessage },
      { message: passwordMessage, setMessage: setPasswordMessage },
      { message: deleteMessage, setMessage: setDeleteMessage },
      { message: clearHistoryMessage, setMessage: setClearHistoryMessage },
      { message: downloadMessage, setMessage: setDownloadMessage },
      { message: recoveryKeyMessage, setMessage: setRecoveryKeyMessage },
      { message: themeMessage, setMessage: setThemeMessage }
    ];

    // Create timeouts for each non-empty message
    const timeouts = messageStates.map(({ message, setMessage }) => {
      if (message) {
        return setTimeout(() => setMessage(''), 3000); // Messages will disappear after 3 seconds
      }
      return null;
    });

    // Cleanup function to clear all timeouts
    return () => {
      timeouts.forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [
    usernameMessage, 
    passwordMessage, 
    deleteMessage, 
    clearHistoryMessage, 
    downloadMessage, 
    recoveryKeyMessage,
    themeMessage
  ]);

  // Add scroll detection effect
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Add scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Loading State
  if (isLoading) return <LoadingSpinner />;

  // Render Component
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
              <a key={name} href={url}>{name.slice(4)}</a>
            ))}
          </div>
        </div>
        <div className="user-info">
          <i className="fas fa-user"></i>
          <span>{username} (Credits: {credits})</span>
          <a href="#" onClick={handleLogout}>Logout</a>
        </div>
      </header>

      {/* Main Content */}
      <h1 className="rainbow-text">Settings for {username}</h1>
      <div className="copyright">Copyright (C) 2025 Ikmal Said. All rights reserved</div>

      {/* Settings Container */}
      <div className="settings-container">

        {/* Username Update Section */}
        <div className="settings-section">
          <h2>Change Username</h2>
          <form onSubmit={handleUsernameUpdate}>
            <div className="message-hint">
              Username must be 3-20 characters long and contain letters, numbers, dots, underscores and hyphens only.
            </div>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="New Username"
              required
            />
            <input
              type="password"
              value={usernamePassword}
              onChange={(e) => setUsernamePassword(e.target.value)}
              placeholder="Current Password"
              required
            />

            <button 
              type="submit" 
              disabled={isProcessing}
              className={isProcessing ? 'processing' : ''}
            >
              Change Username
            </button>
          </form>
          {usernameMessage && <div className="message">{usernameMessage}</div>}
        </div>

        <div className="settings-divider"></div>

        {/* Password Update Section */}
        <div className="settings-section">
          <h2>Change Password</h2>
          <form onSubmit={handlePasswordUpdate}>
            <div className="message-hint">
              Password must be at least 6 characters long and contain at least one number and one symbol (!@#$%^&*).
            </div>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current Password"
              required
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              required
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              required
            />
            <button 
              type="submit" 
              disabled={isProcessing}
              className={isProcessing ? 'processing' : ''}
            >
              Change Password
            </button>
          </form>
          {passwordMessage && <div className="message">{passwordMessage}</div>}
        </div>

        <div className="settings-divider"></div>

        {/* Download Gallery Section */}
        <div className="settings-section">
          <h2>Download Archive</h2>
          <p className="info-text">An archive containing all your images will be downloaded to your device.</p>
          <form onSubmit={handleDownloadGallery}>
            <input
              type="password"
              value={downloadGalleryPassword}
              onChange={(e) => setDownloadGalleryPassword(e.target.value)}
              placeholder="Enter Password to Confirm"
              required
              disabled={!hasHistory}
            />
            <button 
              type="submit"
              disabled={isProcessing || !hasHistory}
            >
              {hasHistory ? 'Download Archive' : 'No Images to Download'}
            </button>
          </form>
          {downloadMessage && <div className="message">{downloadMessage}</div>}
        </div>

        <div className="settings-divider"></div>

        {/* Recovery Key Section */}
        <div className="settings-section">
          <h2>Get My Recovery Key</h2>
          <p className="info-text">It's the only way to recover your account if you forget your password.</p>
          <form onSubmit={handleGetRecoveryKey}>
            <input
              type="password"
              value={recoveryKeyPassword}
              onChange={(e) => setRecoveryKeyPassword(e.target.value)}
              placeholder="Enter Password to Confirm"
              required
            />
            <button 
              type="submit" 
              disabled={isProcessing}
            >
              Copy to Clipboard
            </button>
          </form>
          {recoveryKeyMessage && <div className="message">{recoveryKeyMessage}</div>}
        </div>

        <div className="settings-divider"></div>

        {/* Clear History Section */}
        <div className="settings-section">
          <h2>Clear My History</h2>
          <p className="warning-text">Warning: This will permanently delete your entire history.</p>
          <form onSubmit={handleClearHistory}>
            <input
              type="password"
              value={clearHistoryPassword}
              onChange={(e) => setClearHistoryPassword(e.target.value)}
              placeholder="Enter Password to Confirm"
              required
              disabled={!hasHistory}
            />
            <button 
              type="submit" 
              disabled={isProcessing || !hasHistory}
              className={clearHistoryConfirmClicked ? 'warning' : ''}
            >
              {!hasHistory ? 'No History to Clear' : 
               clearHistoryConfirmClicked ? 'Click Again to Confirm' : 'Clear History'}
            </button>
          </form>
          {clearHistoryMessage && <div className="message">{clearHistoryMessage}</div>}
        </div>
        
        <div className="settings-divider"></div>

        {/* Delete Account Section */}
        <div className="settings-section">
          <h2>Delete My Account</h2>
          <p className="warning-text">Warning: This action cannot be undone.</p>
          <form onSubmit={handleDeleteAccount}>
            <input
              type="password"
              value={deleteConfirmPassword}
              onChange={(e) => setDeleteConfirmPassword(e.target.value)}
              placeholder="Enter Password to Confirm"
              required
            />
            <button 
              type="submit" 
              disabled={isProcessing}
              className={deleteConfirmClicked ? 'warning' : ''}
            >
              {deleteConfirmClicked ? 'Click Again to Confirm' : 'Delete Account'}
            </button>
          </form>
          {deleteMessage && <div className="message error">{deleteMessage}</div>}
        </div>
        
      </div>

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
    <SettingsPage />
  </React.StrictMode>,
  document.getElementById('root')
);

// ===============================
// Styles
// ===============================
const styles = `
  @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css');

  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: #1a1a1a;
    color: #ffffff;
    margin: 0;
    padding: 0;
  }
  html {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  
  html::-webkit-scrollbar {
    display: none;
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
    color: var(--theme-color);
    text-decoration: none;
    transition: color 0.3s;
  }
  .user-info a:hover, .dropbtn:hover {
    color: var(--theme-color);
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
    color: var(--theme-color);
    padding: 0;
    font-size: 14px;
    border: none;
    cursor: pointer;
    transition: color 0.3s;
    display: flex;
    align-items: center;
  }
  .dropbtn:hover {
    color: var(--theme-color);
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
  }
  .dropdown-content a {
    font-size: 14px;
    color: #fff;
    padding: 12px 16px;
    text-decoration: none;
    display: block;
  }
  .dropdown-content a:hover {
    background-color: var(--theme-color);
    color: #1a1a1a;
  }
  .dropdown-content.show {
    display: block;
  }
  input, select, button {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  .rainbow-text {
    text-align: center;
    color: var(--theme-color);
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
  .message {
    margin-top: 20px;
    padding: 15px;
    background-color: #333;
    border-radius: 5px;
    border: 1px solid var(--theme-color);
    text-align: center;
    font-size: 14px;
    color: var(--theme-color);
  }
  .message.error {
    border-color: #ff6b6b;
    color: #ff6b6b;
  }
  .settings-container {
    background-color: #333;
    border-radius: 10px;
    padding: 0px 10px 20px 10px;
    width: 95%;
    max-width: 600px;
    margin: 0 auto;
    font-size: 14px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  .settings-section {
    padding: 10px;
  }

  .settings-section h2 {
    color: var(--theme-color);
    margin-bottom: 20px;
    font-size: 18px;
    text-align: center;
  }

  .settings-section form {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .settings-section input {
    padding: 15px;
    border: 1px solid #444;
    background-color: #222;
    color: #fff;
    border-radius: 5px;
    font-size: 15px;
    width: 100%;
    resize: none;
    overflow: hidden;
    min-height: 42px;
    padding: 10px;
    line-height: 1.2;
    outline: none;
    box-sizing: border-box;
  }

  .settings-section input:hover,
  .settings-section input:focus {
    border-color: var(--theme-color);
    outline: none;
  }

  .settings-section button {
    width: 100%;
    padding: 12px 24px;
    font-size: 15px;
    font-weight: bold;
    background-color: var(--theme-color);
    color: #1a1a1a;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .settings-section button:hover {
    background-color: var(--theme-color);
    opacity: 0.8;
  }

  .settings-divider {
    height: 1px;
    background-color: #444;
    margin: 30px 0px 0px;
    width: 100%;
  }

  .warning-text {
    color: #ff6b6b;
    margin-bottom: 20px;
    font-size: 14px;
    text-align: center;
    font-weight: bold;
  }

  button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .info-text {
    color: #888;
    margin-bottom: 20px;
    font-size: 14px;
    text-align: center;
  }

  /* Scroll to Top Button */
  .scroll-top-button {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999;
    background-color: var(--theme-color);
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

  button.warning {
    background-color: #ff6b6b !important;
  }

  /* Password Visibility */
  .password-toggle {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    transition: color 0.3s ease;
  } 

  .password-toggle:hover {
    color: var(--theme-color);
  }

  .password-toggle:focus {
    outline: none;
  }

  .message-hint {
    color: #888;
    font-size: 14px;
    text-align: center;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  .color-picker-container {
    display: flex;
    align-items: center;
    gap: 15px;
    justify-content: center;
    margin-bottom: 15px;
  }

  .color-picker {
    width: 100px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  }

  .current-color {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 10px;
    background-color: #333;
    border-radius: 5px;
    font-family: monospace;
  }

  .current-color span {
    display: inline-block;
    width: 20px;
    height: 20px;
    border-radius: 3px;
  }

  :root {
    --theme-color: #61dafb;
  }

  .button-group {
    display: flex;
    gap: 10px;
  }

  .button-group button {
    flex: 1;
  }

  .theme-settings-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .setting-group label {
    color: #888;
    font-size: 14px;
  }

  .select-container {
    width: 100%;
    padding: 10px 30px 10px 10px;
    font-size: 15px;
    background-color: #222222;
    color: #fff;
    border: 1px solid #444;
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

  .select-container:hover,
  .select-container:focus {
    border-color: #61dafb;
  }

  .font-preview {
    padding: 10px;
    background-color: #222;
    border: 1px solid #444;
    border-radius: 5px;
    font-size: 15px;
    color: #fff;
    min-height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :root {
    --theme-color: #61dafb;
    --theme-font: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  body {
    font-family: var(--theme-font);
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);

