// ===============================
// React Imports and Constants
// ===============================
const { useState, useEffect } = React;

// ===============================
// Components
// ===============================

// Add these validation functions at the top level
const validateUsername = (username) => {
  // Only allow letters, numbers, dots, underscores, hyphens
  const usernameRegex = /^[a-zA-Z0-9._-]{3,20}$/;
  return usernameRegex.test(username);
};

const validatePassword = (password) => {
  // Minimum 6 chars, at least one number and one symbol
  const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{6,}$/;
  return passwordRegex.test(password);
};

// Update validation helper functions
const checkUsernameRequirements = (username) => {
  return {
    length: username.length >= 3 && username.length <= 20,
    characters: username.length === 0 || /^[a-zA-Z0-9._-]*$/.test(username)
  };
};

const checkPasswordRequirements = (password) => {
  return {
    length: password.length >= 6,
    number: /[0-9]/.test(password),
    symbol: /[!@#$%^&*]/.test(password)
  };
};

// Add a utility function for handling temporary error messages
const showTemporaryError = (elementId, message, duration = 5000) => {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = message;
    setTimeout(() => {
      element.textContent = '';
    }, duration);
  }
};

function Home() {
  const [activeSection, setActiveSection] = useState('welcomeSection');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [registrationKey, setRegistrationKey] = useState('');
  const [usernameValid, setUsernameValid] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [showPassword, setShowPassword] = useState({
    login: false,
    register: false,
    reset: false
  });

  // Add new state variables for error messages
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  // Add useEffect for message timeouts
  useEffect(() => {
    const messageStates = [
      { message: loginError, setMessage: setLoginError },
      { message: registerError, setMessage: setRegisterError },
      { message: resetError, setMessage: setResetError },
      { message: resetMessage, setMessage: setResetMessage },
      { message: copyMessage, setMessage: setCopyMessage }
    ];

    const timeouts = messageStates.map(({ message, setMessage }) => {
      if (message) {
        return setTimeout(() => setMessage(''), 3000);
      }
      return null;
    });

    return () => {
      timeouts.forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, [loginError, registerError, resetError, resetMessage, copyMessage]);

  const showSection = (sectionId) => {
    setActiveSection(sectionId);
    if (sectionId !== 'resetSection') {
      setIsResettingPassword(false);
      setResetUsername('');
      setRecoveryKey('');
      setNewPassword('');
    }
    history.pushState({}, '', '/' + (sectionId === 'welcomeSection' ? '' : sectionId.replace('Section', '')));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
      const response = await fetch('/v1/user/login', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.error) {
        setLoginError(data.error);
      } else if (data.success) {
        window.location.href = '/generator';
      }
    } catch (error) {
      setLoginError('Error:Please try again.');
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    try {
      const response = await fetch('/v1/user/register', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.error) {
        setRegisterError(data.error);
      } else if (data.success && data.recovery_key) {
        setRegistrationKey(data.recovery_key);
        setShowRecoveryKey(true);
      }
    } catch (error) {
      setRegisterError('Error! Please try again.');
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    
    if (!validatePassword(newPassword)) {
      setResetError('Try a stronger password!');
      return;
    }

    try {
      const response = await fetch('/v1/user/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: resetUsername,
          recovery_key: recoveryKey,
          new_password: newPassword
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setResetUsername('');
        setRecoveryKey('');
        setNewPassword('');
        setResetMessage('Password reset successful!<br>Redirecting to login...');
        
        setTimeout(() => {
          setResetMessage('');
          showSection('loginSection');
        }, 2000);
      } else {
        setResetError(data.message);
      }
    } catch (error) {
      setResetError('Error: Please try again.');
    }
  };

  const handleProceedAfterRegistration = () => {
    setShowRecoveryKey(false);
    window.location.href = '/generator';
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/login') {
        setActiveSection('loginSection');
      } else if (path === '/register') {
        setActiveSection('registerSection');
      } else if (path === '/reset') {
        setActiveSection('resetSection');
      } else {
        setActiveSection('welcomeSection');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Show initial section based on URL
    const path = window.location.pathname;
    if (path === '/login') {
      setActiveSection('loginSection');
    } else if (path === '/register') {
      setActiveSection('registerSection');
    } else if (path === '/reset') {
      setActiveSection('resetSection');
    } else {
      setActiveSection('welcomeSection');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Update input handlers
  const handleUsernameInput = (event) => {
    const username = event.target.value;
    const requirements = checkUsernameRequirements(username);
    
    // Update requirement indicators
    document.getElementById('req-username-length').className = requirements.length ? 'requirement met' : 'requirement';
    document.getElementById('req-username-chars').className = (requirements.characters && username.length > 0) ? 'requirement met' : 'requirement';
    
    // Update username validity
    setUsernameValid(requirements.length && requirements.characters);
  };

  const handlePasswordInput = (event) => {
    const password = event.target.value;
    const requirements = checkPasswordRequirements(password);
    
    document.getElementById('req-length').className = requirements.length ? 'requirement met' : 'requirement';
    document.getElementById('req-number').className = requirements.number ? 'requirement met' : 'requirement';
    document.getElementById('req-symbol').className = requirements.symbol ? 'requirement met' : 'requirement';
    
    setPasswordValid(requirements.length && requirements.number && requirements.symbol);
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Update the copy recovery key handler
  const handleCopyRecoveryKey = async () => {
    await navigator.clipboard.writeText(registrationKey);
    setCopyMessage('Recovery key copied!');
  };

  return (
    <div className="container">
      {/* Welcome Section */}
      <div id="welcomeSection" style={{ display: activeSection === 'welcomeSection' ? 'block' : 'none' }}>
        <h1>Welcome to Atelier!</h1>
        <div className="copyright">© 2023-2024 Ikmal Said</div>
        <div className="features">
          <FeatureItem icon="fa-users" number="30M+" text="Active Users" />
          <FeatureItem icon="fa-wand-magic-sparkles" number="3.5M+" text="Daily Generations" />
          <FeatureItem icon="fa-palette" number="420+" text="Creative Styles" />
        </div>
        <button onClick={() => showSection('loginSection')} className="button">Login</button>
        <button onClick={() => showSection('registerSection')} className="button">Register</button>
      </div>

      {/* Login Section */}
      <div id="loginSection" style={{ display: activeSection === 'loginSection' ? 'block' : 'none' }}>
        <h1>Login to Atelier</h1>
        <div className="copyright">© 2023-2024 Ikmal Said</div>
        {loginError && <div className="error">{loginError}</div>}
        <form id="loginForm" onSubmit={handleLogin}>
          <input type="text" name="username" placeholder="Username" required />
          <div className="password-input-container">
            <input 
              type={showPassword.login ? "text" : "password"} 
              name="password" 
              placeholder="Password" 
              required 
            />
            <button 
              type="button"
              className="password-toggle"
              onClick={() => togglePasswordVisibility('login')}
              title={showPassword.login ? "Hide password" : "Show password"}
            >
              <i className={`fas ${showPassword.login ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          <input type="submit" value="Login" />
        </form>
        <div className="links">
          <a href="#" onClick={() => showSection('resetSection')}>Forgot Password?</a><br />
          <a href="#" onClick={() => showSection('registerSection')}>Don't have an account? Sign Up</a><br />
          <a href="#" onClick={() => showSection('welcomeSection')}>← Back to Home</a>
        </div>
      </div>

      {/* Register Section */}
      <div id="registerSection" style={{ display: activeSection === 'registerSection' ? 'block' : 'none' }}>
        {!showRecoveryKey ? (
          <React.Fragment>
            <h1>Sign Up for Atelier</h1>
            <div className="copyright">© 2023-2024 Ikmal Said</div>
            {registerError && <div className="error">{registerError}</div>}
            <div className="register-container">
              <div className="register-form">
                <form id="registerForm" onSubmit={handleRegister}>
                  <input 
                    type="text" 
                    name="username" 
                    placeholder="Username" 
                    onChange={handleUsernameInput}
                    required 
                  />
                  <div className="password-input-container">
                    <input 
                      type={showPassword.register ? "text" : "password"} 
                      name="password" 
                      placeholder="Password" 
                      onChange={handlePasswordInput}
                      required 
                    />
                    <button 
                      type="button"
                      className="password-toggle"
                      onClick={() => togglePasswordVisibility('register')}
                      title={showPassword.register ? "Hide password" : "Show password"}
                    >
                      <i className={`fas ${showPassword.register ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                  <input 
                    type="submit" 
                    value="Register" 
                    disabled={!usernameValid || !passwordValid}
                    className={usernameValid && passwordValid ? '' : 'disabled'}
                  />
                </form>
                <div className="links">
                  <a href="#" onClick={() => showSection('loginSection')}>Already have an account? Login</a><br />
                  <a href="#" onClick={() => showSection('welcomeSection')}>← Back to Home</a>
                </div>
              </div>
              <div className="requirements-container">
                <div className="requirements-section">
                  <h3>Username Requirements:</h3>
                  <div id="req-username-length" className="requirement">
                    <i className="fas fa-check"></i>
                    <span>3-20 characters long</span>
                  </div>
                  <div id="req-username-chars" className="requirement">
                    <i className="fas fa-check"></i>
                    <span>Letters, numbers, dots, underscores, hyphens only</span>
                  </div>
                </div>
                <div className="requirements-section">
                  <h3>Password Requirements:</h3>
                  <div id="req-length" className="requirement">
                    <i className="fas fa-check"></i>
                    <span>At least 6 characters</span>
                  </div>
                  <div id="req-number" className="requirement">
                    <i className="fas fa-check"></i>
                    <span>Contains a number</span>
                  </div>
                  <div id="req-symbol" className="requirement">
                    <i className="fas fa-check"></i>
                    <span>Contains a symbol (!@#$%^&*)</span>
                  </div>
                </div>
              </div>
            </div>
          </React.Fragment>
        ) : (
          <div className="recovery-key-notice">
            <h1>Save Your Recovery Key</h1>
            <div className="copyright">© 2023-2024 Ikmal Said</div>
            <div className="key-display">
              <code>{registrationKey}</code>
              <button 
                onClick={handleCopyRecoveryKey}
                className="copy-button"
              >
                Copy to Clipboard
              </button>
            </div>
            {copyMessage && <div className="message">{copyMessage}</div>}
            <button 
              onClick={handleProceedAfterRegistration}
              className="proceed-button"
            >
              All Set! Proceed
            </button>
          </div>
        )}
      </div>

      {/* Password Reset Section */}
      <div id="resetSection" style={{ display: activeSection === 'resetSection' ? 'block' : 'none' }}>
        <h1>Reset Password</h1>
        <div className="copyright">© 2023-2024 Ikmal Said</div>
        {resetError && <div className="error">{resetError}</div>}
        {resetMessage && <div className="success" dangerouslySetInnerHTML={{__html: resetMessage}} />}
        <div id="resetError" className="error"></div>
        <div id="resetMessage" className="success"></div>
        <form onSubmit={handleResetPassword}>
          <input
            type="text"
            value={resetUsername}
            onChange={(e) => setResetUsername(e.target.value)}
            placeholder="Username"
            required
          />
          <input
            type="text"
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="Recovery Key"
            required
          />
          <div className="password-input-container">
            <input
              type={showPassword.reset ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New Password"
              required
            />
            <button 
              type="button"
              className="password-toggle"
              onClick={() => togglePasswordVisibility('reset')}
              title={showPassword.reset ? "Hide password" : "Show password"}
            >
              <i className={`fas ${showPassword.reset ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          </div>
          <div className="password-hint">
            Password must be at least 6 characters long and contain at least one number and one symbol (!@#$%^&*)
          </div>
          <input type="submit" value="Reset Password" />
        </form>
        <div className="links">
          <a href="#" onClick={() => showSection('loginSection')}>Back to Login</a><br />
          <a href="#" onClick={() => showSection('welcomeSection')}>← Back to Home</a>
        </div>
      </div>
    </div>
  );
}

// Feature Item Component
function FeatureItem({ icon, number, text }) {
  return (
    <div className="feature-item">
      <div className="feature-icon">
        <i className={`fas ${icon}`}></i>
      </div>
      <div className="feature-content">
        <div className="feature-number">{number}</div>
        <div className="feature-text">{text}</div>
      </div>
    </div>
  );
}

// ===============================
// App Initialization
// ===============================
ReactDOM.render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
  document.getElementById('root')
);

// ===============================
// Styles
// ===============================
const styles = `
body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #1a1a1a;
        color: #ffffff;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }
    .container {
        text-align: center;
        background-color: #333;
        padding: 40px;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    }
    h1 {
        color: #61dafb;
        margin-bottom: 30px;
    }
    
    /* Features Section */
    .features {
        display: flex;
        justify-content: space-between;
        align-items: stretch;
        margin: 40px 0;
        gap: 20px;
    }
    .feature-item {
        flex: 1;
        width: 150px;
        background: linear-gradient(145deg, #333333, #2a2a2a);
        border-radius: 15px;
        padding: 25px 20px;
        text-align: center;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(97, 218, 251, 0.1);
    }
    .feature-item::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: radial-gradient(circle at center, rgba(97, 218, 251, 0.1) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    .feature-item:hover {
        transform: translateY(-5px);
        border-color: rgba(97, 218, 251, 0.3);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2),
                    0 0 20px rgba(97, 218, 251, 0.1);
    }
    .feature-item:hover::before {
        opacity: 1;
    }
    .feature-icon {
        font-size: 32px;
        color: #61dafb;
        margin-bottom: 15px;
        position: relative;
    }
    .feature-item:hover .feature-icon {
        animation: pulse 0.6s ease-in-out;
    }
    .feature-content {
        position: relative;
        z-index: 1;
    }
    .feature-number {
        font-size: 28px;
        font-weight: bold;
        background: linear-gradient(120deg, #61dafb, #4fa8d5);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 8px;
        opacity: 0;
        transform: translateY(20px);
        animation: fadeInUp 0.5s forwards;
    }
    .feature-text {
        color: #ccc;
        font-size: 16px;
        opacity: 0;
        transform: translateY(20px);
        animation: fadeInUp 0.5s 0.2s forwards;
    }
    
    /* Animations */
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }
    @keyframes fadeInUp {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .feature-item:hover .feature-icon i {
        animation: glow 1.5s ease-in-out infinite alternate;
    }
    @keyframes glow {
        from {
            text-shadow: 0 0 1px #61dafb,
                        0 0 2px #61dafb;
        }
        to {
            text-shadow: 0 0 1px #61dafb,
                        0 0 2px #61dafb;
        }
    }
    
    /* Button Styles */
    a.button {
        display: inline-block;
        width: 120px; /* Set a fixed width */
        margin: 10px;
        padding: 10px 20px;
        background-color: #61dafb;
        color: #1a1a1a;
        text-decoration: none;
        border-radius: 5px;
        transition: background-color 0.3s;
        text-align: center; /* Center the text */
        font-weight: bold; /* Make button text bold */
    }
    a.button:hover {
        background-color: #4fa8d5;
    }
    input, select, button {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
    
    /* Form Styles */
    form {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    input {
        margin: 10px 0;
        padding: 10px;
        width: 250px;
        background-color: #444;
        border: none;
        color: #fff;
        border-radius: 5px;
        transition: all 0.3s ease;
        outline: none;
        box-sizing: border-box;
    }
    input:focus {
        box-shadow: 0 0 0 2px #61dafb;
    }
    input[type="submit"] {
        width: 250px;
        background-color: #61dafb;
        color: #1a1a1a;
        cursor: pointer;
        transition: background-color 0.3s;
        font-weight: bold;
    }
    input[type="submit"]:hover {
        background-color: #4fa8d5;
    }
    .error {
        color: #ff6b6b;
        margin-bottom: 20px;
    }
    
    /* Hide sections by default */
    #loginSection, #registerSection, #resetSection {
        display: none;
    }

    /* Link Styles */
    a {
        color: #61dafb;
        text-decoration: none;
        transition: color 0.3s ease;
    }

    a:hover {
        color: #4fa8d5;
    }

    /* Back Links and Navigation Links */
    .links {
        margin-top: 20px;
        text-align: center;
    }

    .links a {
        display: inline-block;
        margin: 5px 0;
        color: #61dafb;
    }

    /* Button Styles */
    .button {
        display: inline-block;
        padding: 10px 20px;
        margin: 10px;
        width: 150px;
        border: 1px;
        background-color: #61dafb;
        color: #1a1a1a !important;
        border-radius: 5px;
        font-weight: bold;
        transition: background-color 0.3s ease;
    }

    .button:hover {
        background-color: #4fa8d5;
        color: #1a1a1a !important;
    }

    /* Recovery Key Notice */
    .recovery-key-notice {
        text-align: center;
    }

    .key-display {
        background: #222;
        padding: 20px;
        border-radius: 5px;
        margin: 20px 0;
        word-break: break-all;
    }

    .key-display code {
        font-family: monospace;
        font-size: 18px;
        color: #61dafb;
        display: block;
        margin-bottom: 15px;
    }

    .copy-button {
        background: #444;
        color: #fff;
        border: none;
        padding: 8px 15px;
        border-radius: 3px;
        cursor: pointer;
        transition: background 0.3s;
    }

    .copy-button:hover {
        background: #555;
    }

    .proceed-button {
        background: #61dafb;
        color: #1a1a1a;
        border: none;
        padding: 12px 20px;
        border-radius: 5px;
        font-weight: bold;
        margin-top: 20px;
        cursor: pointer;
        transition: background 0.3s;
    }

    .proceed-button:hover {
        background: #4fa8d5;
    }

    .success {
        color: #61dafb;
        margin-bottom: 20px;
    }

    /* Reset Section */
    #resetSection {
        display: none;
    }

    /* Register Container */
    .register-container {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 40px;
        max-width: 800px;
        margin: 0 auto;
    }

    .register-form {
        flex: 1;
        align-self: center;
    }

    .requirements-container {
        flex: 1;
        text-align: left;
    }

    .requirements-section {
        background: #2a2a2a;
        padding: 20px;
        border-radius: 8px;
        margin-top: 20px;
    }

    .requirements-section:first-child {
        margin-top: 0;
    }

    .requirements-section h3 {
        color: #61dafb;
        margin-top: 0;
        margin-bottom: 15px;
        font-size: 1.1em;
    }

    .requirement {
        color: #666;
        margin: 10px 0;
        transition: color 0.3s ease;
        display: flex;
        align-items: flex-start;
    }

    .requirement.met {
        color: #61dafb;
    }

    .requirement i {
        margin-right: 8px;
        width: 16px;
        text-align: center;
        margin-top: 3px;
    }

    .requirement span {
        flex: 1;
        line-height: 1.4;
    }

    input[type="submit"].disabled {
        background-color: #4a4a4a;
        color: #ccc;
        cursor: not-allowed;
        opacity: 0.7;
    }

    input[type="submit"].disabled:hover {
        background-color: #4a4a4a;
    }

    .password-input-container {
        position: relative;
        width: 250px;
        margin: 10px 0;
    }

    .password-input-container input {
        margin: 0;
        padding-right: 40px;
        width: 100%;
        box-sizing: border-box;
    }

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
        color: #61dafb;
    }

    .password-toggle:focus {
        outline: none;
    }

    .password-hint {
        color: #888;
        font-size: 12px;
        margin: -5px 0 15px 0;
        text-align: justify;
        max-width: 250px;
        margin-left: auto;
        margin-right: auto;
    }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
document.head.appendChild(styleElement); 