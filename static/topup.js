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
  .catch(error => console.error('Error:', error));
}

function getSavingsPercentage(bundle) {
  const basePrice = 0.199;
  const actualPrice = bundle.price / bundle.credits;
  const savings = ((basePrice - actualPrice) / basePrice) * 100;
  return Math.round(savings);
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
// Confetti Effect Handler
// ===============================
function fireConfetti(bundleSize) {
  // More reasonable scaling for different bundle sizes
  const baseCount = 50; // Reduced base count for smaller purchases
  const count = Math.min(baseCount * Math.sqrt(bundleSize / 50), 800); // Smoother scaling

  const defaults = {
    origin: { y: 0.7 },
    spread: 360,
    ticks: 100,
    gravity: 0.8,
    decay: 0.94,
    startVelocity: 20 + Math.min(bundleSize / 200, 30), // Cap max velocity
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  }

  // Cheerful color combinations
  const colorSets = [
    ['#FF69B4', '#FFD700', '#87CEEB'], // Pink, Gold, Sky Blue
    ['#FF7F50', '#98FB98', '#DDA0DD'], // Coral, Pale Green, Plum
    ['#40E0D0', '#FF6B6B', '#FFCE54'], // Turquoise, Salmon, Amber
    ['#9B59B6', '#3498DB', '#2ECC71']  // Purple, Blue, Green
  ];

  // Base celebration for all purchases
  fire(0.25, {
    spread: 26,
    startVelocity: 25,
    colors: colorSets[0],
    shapes: ['circle', 'square']
  });

  fire(0.2, {
    spread: 60,
    colors: colorSets[1],
    shapes: ['circle']
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8 + Math.min(bundleSize / 1000, 0.8),
    colors: colorSets[2],
    shapes: ['circle', 'square']
  });

  // Side shots for purchases over 100 credits
  if (bundleSize >= 10) {
    const sideParticles = Math.floor(20 * Math.sqrt(bundleSize / 100));
    setTimeout(() => {
      confetti({
        particleCount: sideParticles,
        angle: 60,
        spread: 50,
        origin: { x: 0 },
        colors: colorSets[3]
      });
      confetti({
        particleCount: sideParticles,
        angle: 120,
        spread: 50,
        origin: { x: 1 },
        colors: colorSets[3]
      });
    }, 300);
  }

  // Special effects for medium purchases (200+)
  if (bundleSize >= 100) {
    setTimeout(() => {
      fire(0.2, {
        spread: 120,
        startVelocity: 30,
        decay: 0.92,
        scalar: 1.2,
        shapes: ['star'],
        colors: ['#FFD700', '#FFA500', '#FF69B4']
      });
    }, 600);
  }

  // Premium celebration for large purchases (500+)
  if (bundleSize >= 1000) {
    setTimeout(() => {
      const duration = 2000;
      const end = Date.now() + duration;
      
      (function frame() {
        const timeLeft = end - Date.now();
        
        if (timeLeft <= 0) return;
        
        confetti({
          particleCount: 2,
          angle: performance.now() * 0.6,
          spread: 60,
          origin: { x: 0.5, y: 0.5 },
          colors: ['#FFD700', '#FF69B4', '#87CEEB'],
          shapes: ['star'],
          ticks: 200,
          startVelocity: 30,
          scalar: 1.2,
          gravity: 0.6,
          drift: 0.1
        });
        
        requestAnimationFrame(frame);
      }());
    }, 800);
  }
}

// ===============================
// Main TopupPage Component
// ===============================
function TopupPage() {
  // State Management
  const [username, setUsername] = useState('');
  const [credits, setCredits] = useState(0);
  const [pinCode, setPinCode] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [menuItems, setMenuItems] = useState({});
  const [creditBundles, setCreditBundles] = useState({});
  const [isRainbowAnimating, setIsRainbowAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const dropdownRef = React.useRef(null);

  // Animation Handlers
  const triggerRainbowAnimation = () => {
    setIsRainbowAnimating(true);
    setTimeout(() => setIsRainbowAnimating(false), 3000);
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

    // Fetch menu items and credit bundles
    Promise.all([
      fetch('/v1/presets/menu').then(res => res.json()),
      fetch('/v1/credits/bundles').then(res => res.json())
    ]).then(([menuData, bundleData]) => {
      setMenuItems(menuData.menu_items);
      setCreditBundles(bundleData);
    }).catch(error => console.error('Error fetching data:', error));

    // Dropdown click outside handler
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Event Handlers
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  const handlePinSubmit = (e) => {
    e.preventDefault();
    setMessage('');
    setIsProcessing(true);
    setIsRainbowAnimating(true);
    
    fetch('/v1/credits/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_code: pinCode }),
    })
    .then(response => response.json())
    .then(data => {
      setMessage(data.message);
      if (data.success) {
        const newBalance = parseInt(data.message.split('New balance: ')[1]);
        const creditsAdded = newBalance - credits;
        setCredits(newBalance);
        fireConfetti(creditsAdded);
      }
      setPinCode('');
      setIsRainbowAnimating(false);
    })
    .catch(error => {
      console.error('Error:', error);
      setMessage('An error occurred. Please try again.');
      setIsRainbowAnimating(false);
    })
    .finally(() => setIsProcessing(false));
  };

  const handleBuyCredits = (bundleSize) => {
    setMessage('');
    setIsProcessing(true);
    setIsRainbowAnimating(true);

    fetch('/v1/credits/purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bundle_size: bundleSize }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Extract PIN from the message using the format "PIN code is: XXXXXXXX"
        const pinMatch = data.message.match(/PIN code is: ([A-Z0-9]+)/);
        if (pinMatch && pinMatch[1]) {
          setPinCode(pinMatch[1]); // Set the PIN in the input box
        }
        setMessage(`${data.message} - PIN has been automatically entered above. Click Submit to redeem your credits.`);
      } else {
        setMessage(`Error: ${data.message}`);
      }
      setIsRainbowAnimating(false);
    })
    .catch(error => {
      console.error('Error:', error);
      setMessage('An error occurred during purchase. Please try again.');
      setIsRainbowAnimating(false);
    })
    .finally(() => {
      setIsProcessing(false);
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

      {/* Main Content */}
      <RainbowText 
        text={`Topup for ${username}`} 
        isAnimating={isRainbowAnimating} 
      />
      <div className="copyright">© 2023-2024 Ikmal Said</div>

      {/* Topup Container */}
      <div className="topup-container">
        <div className="current-credits">
          Current Credits:<br />
          <span className="credit-amount">{credits}</span>
        </div>
        <div className="credit-bundles">
          <h2>Buy Credit Bundles</h2>
          <div className="bundle-buttons">
            {Object.entries(creditBundles).reverse().map(([size, bundle]) => (
              <button 
                key={size} 
                onClick={() => handleBuyCredits(size)}
                disabled={isProcessing}
                className={isProcessing ? 'processing' : ''}
              >
                <div className="bundle-icon"><i className="fas fa-coins"></i></div>
                <div className="bundle-details">
                  <span className="bundle-amount">{bundle.credits} Credits</span>
                  <span className="bundle-price">RM{bundle.price.toFixed(2)}</span>
                  {getSavingsPercentage(bundle) > 0 && (
                    <span className="bundle-savings">Save {getSavingsPercentage(bundle)}%</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="topup-divider"></div>

        <div className="pin-topup">
          <h2>Redeem PIN Code</h2>
          <form onSubmit={handlePinSubmit}>
            <input
              type="text"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              placeholder="Enter your PIN code"
              required
            />
            <button 
              type="submit" 
              disabled={isProcessing}
              className={isProcessing ? 'processing' : ''}
            >
              Submit
            </button>
          </form>
        </div>
        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
}

// ===============================
// App Initialization
// ===============================
ReactDOM.render(
  <React.StrictMode>
    <TopupPage />
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
    background-color: #555;
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
  .topup-container {
    background-color: #333;
    border-radius: 10px;
    padding: 30px;
    width: 95%;
    max-width: 600px;
    margin: 0 auto;
    font-size: 14px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .current-credits {
    font-size: 24px;
    margin-bottom: 30px;
    text-align: center;
    color: #61dafb;
  }
  .credit-amount {
    font-weight: bold;
    font-size: 36px;
  }
  .credit-bundles h2, .pin-topup h2 {
    color: #61dafb;
    margin-bottom: 20px;
    font-size: 18px;
    text-align: center;
  }
  .bundle-buttons {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .bundle-buttons button {
    background-color: #444;
    color: #fff;
    border: 2px solid transparent;
    padding: 20px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin-bottom: 20px;
    flex-basis: calc(33% - 10px);
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  .bundle-buttons button:hover {
    border-color: #61dafb;
    background-color: #444;
  }
  .bundle-icon {
    font-size: 24px;
    margin-bottom: 10px;
    color: #61dafb;
  }
  .bundle-details {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .bundle-amount {
    font-size: 15px;
    font-weight: bold;
    margin-bottom: 5px;
  }
  .bundle-price {
    font-size: 16px;
    margin-bottom: 5px;
  }
  .bundle-savings {
    font-size: 14px;
    color: #4CAF50;
  }
  .pin-topup form {
    display: flex;
  }
  .pin-topup input {
    flex-grow: 1;
    padding: 15px;
    border: 1px solid #444;
    background-color: #222;
    color: #fff;
    border-radius: 5px 0 0 5px;
    font-size: 15px;
  }
  .pin-topup input:hover, .pin-topup input:focus {
    border-color: #61dafb;
    outline: none;
  }
  .pin-topup button {
    padding: 15px 25px;
    background-color: #61dafb;
    color: #1a1a1a;
    border: none;
    border-radius: 0 5px 5px 0;
    cursor: pointer;
    font-size: 15px;
    font-weight: bold;
    transition: 0.3s all
  }
  .pin-topup button:hover {
    background-color: #4fa8d5;
  }
  .message {
    margin-top: 25px;
    padding: 15px;
    background-color: #333;
    border-radius: 5px;
    border: 1px solid;
    text-align: center;
    font-size: 15px;
    color: #61dafb;
  }
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
    100% { transform: translateY(0px); }
  }

  /* Add success message animation */
  .message:contains("success") {
    animation: float 2s ease-in-out infinite;
    background-color: rgba(76, 175, 80, 0.2);
    border: 1px solid #4CAF50;
    box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
  }

  .bundle-buttons button:disabled {
    opacity: 0.8;
    cursor: not-allowed;
    transform: none;
    pointer-events: none;
    position: relative;
  }

  .bundle-buttons button.processing {
    background-color: #444;
    color: #aaa;
  }

  /* Add subtle pulsing animation for processing state */
  @keyframes pulse {
    0% { opacity: 0.8; }
    50% { opacity: 0.9; }
    100% { opacity: 0.8; }
  }

  .topup-divider {
    height: 1px;
    background-color: #444;
    margin: 30px 0px 30px;
    width: 100%;
  }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement);
