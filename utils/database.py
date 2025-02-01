import sqlite3
import secrets
import string
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class Database:
    """Atelier Database System. Copyright (C) 2024 Ikmal Said. All rights reserved."""
    def __init__(self, db_name='atelierdb.db'):
        """Initialize database connection with specified database name"""
        self.db_name = db_name
        self.create_tables()
        # self.create_default_user() # Uncomment this line to create a default user
    
    # Please change the default username and password to your own
    def create_default_user(self, username = 'admin', password = '12345678'):
        """Create default admin user if it doesn't exist"""
        default_recovery_key = self.generate_recovery_key()
        
        user_id = self.get_user_id(username)
        if user_id is None:
            user_id = self.add_user(username, password)
            if user_id:
                self.store_recovery_key(user_id, default_recovery_key)
            return True
        return False

    def get_current_timestamp(self):
        """Return current timestamp in dd/mm/yyyy HH:MM:SS format"""
        return datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    
    def get_connection(self):
        """Create and return a new database connection with WAL journal mode"""
        conn = sqlite3.connect(self.db_name)
        conn.execute('PRAGMA journal_mode=WAL')
        return conn

    def create_tables(self):
        """Create necessary database tables if they don't exist"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_list (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    account_enabled BOOLEAN DEFAULT 1,
                    signup_date TEXT DEFAULT CURRENT_TIMESTAMP,
                    last_signin TEXT,
                    total_credits_used INTEGER DEFAULT 0,
                    total_credits_added INTEGER DEFAULT 100,
                    total_generations INTEGER DEFAULT 0,
                    last_credit_added TEXT,
                    last_credit_used TEXT
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    type TEXT NOT NULL,
                    task TEXT,
                    detail TEXT,
                    status TEXT NOT NULL,
                    timestamp TEXT,
                    result_url TEXT,
                    FOREIGN KEY (user_id) REFERENCES user_list (id)
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_credits (
                    user_id INTEGER PRIMARY KEY,
                    credits INTEGER NOT NULL DEFAULT 100,
                    FOREIGN KEY (user_id) REFERENCES user_list (id)
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_recovery_keys (
                    user_id INTEGER PRIMARY KEY,
                    recovery_key TEXT NOT NULL,
                    FOREIGN KEY (user_id) REFERENCES user_list (id)
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS user_preferences (
                    user_id INTEGER PRIMARY KEY,
                    theme_color TEXT DEFAULT '#61dafb',
                    theme_font TEXT DEFAULT 'Segoe UI',
                    FOREIGN KEY (user_id) REFERENCES user_list (id)
                )
            ''')
            conn.commit()

    def add_user(self, username, password):
        """Add new user to database with default credits and theme preferences"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            password_hash = generate_password_hash(password)
            try:
                cursor.execute('''
                    INSERT INTO user_list (
                        username, password_hash, account_enabled, 
                        signup_date, total_credits_used, total_credits_added, 
                        total_generations
                    ) VALUES (?, ?, 1, ?, 0, 100, 0)
                ''', (username, password_hash, self.get_current_timestamp()))
                user_id = cursor.lastrowid
                # Add default credits
                cursor.execute('INSERT INTO user_credits (user_id, credits) VALUES (?, ?)', (user_id, 100))
                # Add default theme preferences
                cursor.execute('INSERT INTO user_preferences (user_id, theme_color, theme_font) VALUES (?, ?, ?)', 
                             (user_id, '#61dafb', 'Segoe UI'))
                conn.commit()
                return user_id
            except sqlite3.IntegrityError:
                return None

    def check_user(self, username, password):
        """Verify user credentials and return user ID if valid"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT id, password_hash, account_enabled 
                FROM user_list 
                WHERE username = ?
            ''', (username,))
            user = cursor.fetchone()
            if user and user[2] and check_password_hash(user[1], password):
                return user[0]
            return None

    def add_user_history(self, user_id, type, task, detail, status='failed', timestamp=None, result_url=None):
        """Add new entry to user's activity history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('INSERT INTO user_history (user_id, type, task, detail, status, timestamp, result_url) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                              (user_id, type, task, detail, status, timestamp, result_url))
                conn.commit()
                return cursor.lastrowid
            except Exception as e:
                raise e

    def get_user_id(self, username):
        """Retrieve user ID by username"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM user_list WHERE username = ?', (username,))
            result = cursor.fetchone()
            return result[0] if result else None

    def get_user_history(self, user_id):
        """Get complete history of user's activities"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT type, task, detail, status, timestamp, result_url FROM user_history WHERE user_id = ? ORDER BY timestamp DESC', (user_id,))
            return cursor.fetchall()

    def get_user_gallery(self, user_id):
        """Get successful results with URLs from user's history"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT type, task, detail, timestamp, result_url 
                FROM user_history 
                WHERE user_id = ? 
                    AND result_url IS NOT NULL 
                    AND status = "success"
                ORDER BY timestamp DESC
            ''', (user_id,))
            return cursor.fetchall()

    def get_user_credits(self, user_id):
        """Get current credit balance for user"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT credits FROM user_credits WHERE user_id = ?', (user_id,))
            result = cursor.fetchone()
            return result[0] if result else 0

    def update_user_credits(self, user_id, new_credits):
        """Update user's credit balance and tracking"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            current_credits = self.get_user_credits(user_id)
            difference = new_credits - current_credits
            
            cursor.execute('UPDATE user_credits SET credits = ? WHERE user_id = ?', 
                          (new_credits, user_id))
            
            # Update credit tracking
            timestamp = self.get_current_timestamp()
            if difference > 0:
                cursor.execute('''
                    UPDATE user_list 
                    SET total_credits_added = total_credits_added + ?,
                        last_credit_added = ?
                    WHERE id = ?
                ''', (difference, timestamp, user_id))
            else:
                cursor.execute('''
                    UPDATE user_list 
                    SET total_credits_used = total_credits_used + ?,
                        last_credit_used = ?
                    WHERE id = ?
                ''', (abs(difference), timestamp, user_id))
            
            conn.commit()

    def deduct_credit(self, user_id, value=1):
        """Deduct specified credits from user's balance"""
        current_credits = self.get_user_credits(user_id)
        if current_credits > 0:
            self.update_user_credits(user_id, current_credits - value)
            return True
        return False

    def close(self):
        """Close database connection"""
        pass

    def update_password(self, user_id, new_password):
        """Update user's password hash"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                password_hash = generate_password_hash(new_password)
                cursor.execute('UPDATE user_list SET password_hash = ? WHERE id = ?', 
                              (password_hash, user_id))
                conn.commit()
                return True
            except:
                return False

    def delete_user(self, user_id):
        """Delete user and all associated data"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                # Delete user's credits
                cursor.execute('DELETE FROM user_credits WHERE user_id = ?', (user_id,))
                # Delete user's history
                cursor.execute('DELETE FROM user_history WHERE user_id = ?', (user_id,))
                # Delete user account
                cursor.execute('DELETE FROM user_list WHERE id = ?', (user_id,))
                conn.commit()
                return True
            except:
                return False

    def update_username(self, user_id, new_username):
        """Update user's username"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('UPDATE user_list SET username = ? WHERE id = ?', 
                              (new_username, user_id))
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                return False
            except:
                return False

    def clear_user_history(self, user_id):
        """Delete all history entries for user"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute('DELETE FROM user_history WHERE user_id = ?', (user_id,))
                conn.commit()
                return True
            except:
                return False

    def generate_recovery_key(self):
        """Generate random 24-character recovery key"""
        alphabet = string.ascii_letters + string.digits
        return ''.join(secrets.choice(alphabet) for _ in range(24))

    def store_recovery_key(self, user_id, recovery_key):
        """Store or update recovery key for user"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('INSERT OR REPLACE INTO user_recovery_keys (user_id, recovery_key) VALUES (?, ?)',
                          (user_id, recovery_key))
            conn.commit()

    def get_recovery_key(self, user_id, password):
        """Retrieve recovery key if password is correct"""
        cursor = self.get_connection().cursor()
        cursor.execute('SELECT password_hash FROM user_list WHERE id = ?', (user_id,))
        result = cursor.fetchone()
        
        if result and check_password_hash(result[0], password):
            cursor.execute('SELECT recovery_key FROM user_recovery_keys WHERE user_id = ?', (user_id,))
            result = cursor.fetchone()
            return result[0] if result else None
        return None

    def verify_recovery_key(self, username, recovery_key):
        """Verify recovery key matches user and return user ID if valid"""
        cursor = self.get_connection().cursor()
        cursor.execute('''
            SELECT user_list.id 
            FROM user_list 
            JOIN user_recovery_keys ON user_list.id = user_recovery_keys.user_id 
            WHERE user_list.username = ? AND user_recovery_keys.recovery_key = ?
        ''', (username, recovery_key))
        result = cursor.fetchone()
        return result[0] if result else None

    def increment_generations(self, user_id):
        """Increment total generations counter"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_list 
                SET total_generations = total_generations + 1 
                WHERE id = ?
            ''', (user_id,))
            conn.commit()

    def get_user_stats(self, user_id):
        """Get user statistics"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT 
                    account_enabled,
                    signup_date,
                    total_credits_used, 
                    total_credits_added, 
                    total_generations,
                    last_signin,
                    last_credit_added,
                    last_credit_used
                FROM user_list 
                WHERE id = ?
            ''', (user_id,))
            result = cursor.fetchone()
            if result:
                return {
                    'account_enabled': bool(result[0]),
                    'signup_date': result[1],
                    'total_credits_used': result[2],
                    'total_credits_added': result[3],
                    'total_generations': result[4],
                    'last_signin': result[5],
                    'last_credit_added': result[6],
                    'last_credit_used': result[7]
                }
            return None

    def toggle_account_status(self, user_id, enabled=True):
        """Enable or disable user account"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_list 
                SET account_enabled = ? 
                WHERE id = ?
            ''', (enabled, user_id))
            conn.commit()
            return True

    def update_last_signin(self, user_id):
        """Update user's last signin timestamp"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE user_list 
                SET last_signin = ? 
                WHERE id = ?
            ''', (self.get_current_timestamp(), user_id))
            conn.commit()

    def get_user_gallery_by_username(self, username):
        """Get successful results with URLs from user's history by username"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT h.type, h.task, h.detail, h.timestamp, h.result_url 
                FROM user_history h
                JOIN user_list u ON h.user_id = u.id
                WHERE u.username = ? 
                    AND h.result_url IS NOT NULL 
                    AND h.status = "success"
                ORDER BY h.timestamp DESC
            ''', (username,))
            return cursor.fetchall()


    def set_theme(self, user_id, color=None, font=None):
        """Set user's theme preferences"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Create lists for columns and values
            columns = ['user_id']
            values = [user_id]
            update_parts = []
            
            # Add color if provided
            if color is not None:
                columns.append('theme_color')
                values.append(color)
                update_parts.append('theme_color = ?')
            
            # Add font if provided
            if font is not None:
                columns.append('theme_font')
                values.append(font)
                update_parts.append('theme_font = ?')
            
            # Construct the SQL query
            columns_str = ', '.join(columns)
            placeholders = ', '.join(['?'] * len(values))
            update_clause = ', '.join(update_parts)
            
            query = f'''
                INSERT INTO user_preferences ({columns_str})
                VALUES ({placeholders})
                ON CONFLICT(user_id) DO UPDATE SET {update_clause}
            '''
            
            try:
                cursor.execute(query, values)
                conn.commit()
                return True
            except Exception as e:
                print(f"Error setting theme: {e}")
                return False

    def get_theme(self, user_id):
        """Get user's theme preferences"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT theme_color, theme_font 
                FROM user_preferences 
                WHERE user_id = ?
            ''', (user_id,))
            result = cursor.fetchone()
            return {
                'color': result[0] if result else '#61dafb',
                'font': result[1] if result else 'Segoe UI'
            }

