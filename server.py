from flask import Flask, request, jsonify, render_template, redirect, url_for, session, send_file, send_from_directory
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
from collections import OrderedDict
from flask_limiter import Limiter
from threading import Timer
from functools import wraps
from PIL import Image
import tempfile
import zipfile
import base64
import time
import uuid
import os

from atelier_client import AtelierClient
from database import DBase
from credits import Credits

app = Flask(__name__)
app.secret_key = 'your_secret_key'

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri="memory://"
    )

app.permanent_session_lifetime = timedelta(hours=1)

sap = AtelierClient()
sdb = DBase()
scr = Credits()

# Cost Information ###################################################

costs = {
    'generate': 1,
    'upscale': 1,
    'variation': 1,
    'atelier': 1,
    'guide': 1
}

menus= OrderedDict([
    ('💰 Topup', "/topup"),
    ('🎨 Atelier Gen', "/atelier"),
    ('🎯 Atelier Guide', "/guide"),
    ('✨ Generator', "/generator"),
    ('🔍 Upscale', "/upscaler"),
    ('🔄 Variation', "/variation"),
    ('🖼️ Gallery', "/gallery"),
    ('📜 History', "/history"),
    ('⚙️ Settings', "/settings")
])

# Authentication & Decorators ##########################################

def login_required(f):
    """Decorator to ensure user is authenticated before accessing routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('index'))
        
        # Check if session has expired
        if 'last_activity' in session:
            try:
                last_activity = datetime.fromisoformat(str(session['last_activity']))
                if datetime.now() - last_activity > timedelta(minutes=30):
                    session.clear()
                    return redirect(url_for('index'))
            except (TypeError, ValueError):
                # If there's any error parsing the timestamp, clear session and redirect
                session.clear()
                return redirect(url_for('index'))
        
        # Update last activity time
        session['last_activity'] = datetime.now().isoformat()
        return f(*args, **kwargs)
    return decorated_function

# Utility Functions ###################################################

def get_temp_file_path():
    """Return temporary file path"""
    return os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}.png")

def create_temp_image_file(image_data):
    """Create temporary file from base64 image data and return file path"""
    image_bytes = base64.b64decode(image_data.split(',')[1] if ',' in image_data else image_data)
    with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
        temp_file.write(image_bytes)
        return temp_file.name

def get_image_url(file_path):
    """Convert file path to encoded URL for serving images"""
    if file_path:
        relative_path = os.path.relpath(file_path, start=sap.save_dir)
        relative_path = relative_path.replace('\\', '/')
        encoded_path = base64.urlsafe_b64encode(relative_path.encode()).decode().rstrip('=')
        return f"/v1/image/{encoded_path}"
    return None

def decode_image_path(encoded_path):
    """Decode URL-safe base64 encoded path back to original path"""
    # Add padding characters back if needed
    padding = 4 - (len(encoded_path) % 4)
    if padding != 4:
        encoded_path += '=' * padding
    try:
        decoded_path = base64.urlsafe_b64decode(encoded_path).decode()
        return decoded_path
    except:
        return None

def get_current_timestamp():
    """Return current timestamp in dd/mm/yyyy HH:MM:SS format"""
    return datetime.now().strftime('%d/%m/%Y %H:%M:%S')

def increment_user_stats(user_id, feature):
    """Increment user's generation stats and track credit usage"""
    try:
        # Increment total generations
        sdb.increment_generations(user_id)
        # Track credit usage based on feature cost
        cost = costs.get(feature.lower(), 1)
        sdb.update_user_credits(user_id, sdb.get_user_credits(user_id) - cost)
    except Exception as e:
        print(f"Error updating user stats: {e}")

# Web Routes - Favicon & Image Serving #################################

@app.route('/favicon.ico')
def favicon():
    """Serve favicon with caching headers"""
    response = send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')
    
    response.headers['Cache-Control'] = 'public, max-age=31536000'  # Cache for 1 year
    response.headers['Expires'] = (datetime.now() + timedelta(days=365)).strftime('%a, %d %b %Y %H:%M:%S GMT')
    
    return response
    
@app.route('/v1/image/<path:encoded_filename>')
@login_required
@limiter.exempt
def serve_image(encoded_filename):
    """Serve image files with caching and conditional GET support"""
    filename = decode_image_path(encoded_filename)
    if not filename:
        return 'Not Found', 404
        
    file_path = os.path.join(sap.save_dir, filename)
    if os.path.isfile(file_path):
        # Get file's last modification time and size for ETag
        last_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
        file_size = os.path.getsize(file_path)
        etag = f'"{file_size}-{int(last_modified.timestamp())}"'
        
        # Check If-None-Match header (ETag)
        if_none_match = request.headers.get('If-None-Match')
        if if_none_match and if_none_match == etag:
            return '', 304
        
        # Check If-Modified-Since header
        if_modified_since = request.headers.get('If-Modified-Since')
        if if_modified_since:
            try:
                if_modified_since = datetime.strptime(if_modified_since, '%a, %d %b %Y %H:%M:%S GMT')
                if last_modified <= if_modified_since:
                    return '', 304
            except ValueError:
                pass  # Invalid date format, ignore
        
        response = send_file(file_path)
        
        # Set cache control headers
        response.headers['Cache-Control'] = 'public, max-age=31536000'  # 1 year
        response.headers['Last-Modified'] = last_modified.strftime('%a, %d %b %Y %H:%M:%S GMT')
        response.headers['ETag'] = etag
        response.headers['Expires'] = (datetime.now() + timedelta(days=365)).strftime('%a, %d %b %Y %H:%M:%S GMT')
        
        return response
    else:
        return 'Not Found', 404

@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded errors"""
    return jsonify({
        'error': 'Rate limit exceeded. Please try again later.',
        'retry_after': e.description
    }), 429

# Web Routes - Presets #################################################

@app.route('/v1/presets/styles')
@login_required
@limiter.exempt
def get_image_styles():
    """Return available image style presets"""
    styles = sap.list_sty_styles
    return jsonify({'styles': styles})

@app.route('/v1/presets/sizes')
@login_required
@limiter.exempt
def get_image_sizes():
    """Return available image size options"""
    sizes = sap.list_atr_size
    return jsonify({'sizes': sizes})

@app.route('/v1/presets/models')
@login_required
@limiter.exempt
def get_generator_models():
    """Return available generator model options"""
    models = sap.list_atr_models
    return jsonify({'models': models})

@app.route('/v1/presets/variation')
@login_required
@limiter.exempt
def get_variation_models():
    """Return available variation model options"""
    models = sap.list_ime_variations
    return jsonify({'models': models})

@app.route('/v1/presets/atelier/sizes')
@login_required
@limiter.exempt
def get_atelier_sizes():
    """Return available Atelier size options"""
    sizes = sap.list_atr_size
    return jsonify({'sizes': sizes})

@app.route('/v1/presets/atelier/models')
@login_required
@limiter.exempt
def get_atelier_models():
    """Return available Atelier model options"""
    models = sap.list_atr_models
    return jsonify({'models': models})

@app.route('/v1/presets/atelier/lora/svi')
@login_required
@limiter.exempt
def get_atelier_lora_svi():
    """Return available Atelier LoRA styles"""
    lora = sap.list_atr_lora_svi
    return jsonify({'atelier_styles': lora})

@app.route('/v1/presets/atelier/lora/flux')
@login_required
@limiter.exempt
def get_atelier_lora_flux():
    """Return available Atelier LoRA styles"""
    lora = sap.list_atr_lora_flux
    return jsonify({'atelier_styles': lora})

@app.route('/v1/presets/atelier/controls')
@login_required
@limiter.exempt
def get_atelier_controls():
    """Return available Atelier control options"""
    controls = sap.list_atr_guide
    return jsonify({'atelier_controls': controls})

@app.route('/v1/presets/menu')
@login_required
@limiter.exempt
def get_menu_items():
    """Return numbered menu items and their routes"""
    return jsonify({'menu_items': {f"{str(i).zfill(2)}. {k}":
        v for i, (k, v) in enumerate(menus.items(), 1)}})

# Web Routes - Theme Settings ###########################################

@app.route('/v1/user/settings/theme')
@login_required
@limiter.exempt
def get_theme():
    """Get user's theme preferences"""
    user_id = session['user_id']
    theme = sdb.get_theme(user_id)
    return jsonify(theme)   
 
@app.route('/v1/user/settings/theme/update', methods=['POST'])
@login_required
@limiter.exempt
def set_theme():
    """Update user's theme preferences"""
    user_id = session['user_id']
    color = request.json.get('color')
    font = request.json.get('font')
    
    if sdb.set_theme(user_id, color=color, font=font):
        return jsonify({
            'success': True,
            'message': 'Theme updated successfully'
        })
    return jsonify({
        'success': False,
        'message': 'Failed to update theme'
    })

# Web Routes - Credit Management #######################################

@app.route('/v1/credits/costs')
@login_required
@limiter.exempt
def get_credit_costs():
    """Return credit costs for different operations"""
    return jsonify(costs)

@app.route('/v1/credits/bundles')
@login_required
@limiter.exempt
def get_credit_bundles():
    """Return available credit bundle options"""
    return jsonify(scr.get_credit_bundles())

@app.route('/v1/credits/purchase', methods=['POST'])
@login_required
@limiter.exempt
def purchase_credits():
    """Process credit bundle purchase and return PIN code"""
    user_id = session['user_id']
    bundle_size = request.json.get('bundle_size')
    
    success, result = scr.purchase_credits(user_id, bundle_size)
    return jsonify({
        'success': success,
        'pin_code': result if success else None,
        'message': f"Purchase successful. Your PIN code is: {result}" if success else result
    })

@app.route('/v1/credits/redeem', methods=['POST'])
@login_required
@limiter.limit("10 per minute")
def redeem_pin():
    """Validate and redeem PIN code for credits"""
    user_id = session['user_id']
    pin_code = request.json.get('pin_code')
    time.sleep(1.5)
    
    success, message = scr.redeem_pin_code(user_id, pin_code)
    return jsonify({'success': success, 'message': message})

# Web Routes - User Stats #############################################

@app.route('/v1/user/stats')
@login_required
@limiter.exempt
def get_current_user_stats():
    """Return current user's stats"""
    user_id = session['user_id']
    
    return jsonify(sdb.get_user_stats(user_id))

@app.route('/v1/user/stats/<username>')
@login_required
@limiter.exempt
def get_user_stats(username):
    """Return specific user's stats"""
    if username == session['user']:
        return jsonify({'message': 'Not applicable'}), 400

    user_id = sdb.get_user_id(username)
    
    if user_id is None:
        return jsonify({'message': 'User not found'}), 404
    
    return jsonify(sdb.get_user_stats(user_id))

# Web Routes - User Information #########################################

@app.route('/v1/user/info')
@login_required
@limiter.exempt
def get_current_user_info():
    """Return current user's information"""
    user_id = session['user_id']
    username = session['user']

    return jsonify({
        'username': username,
        'credits': sdb.get_user_credits(user_id)
    })

@app.route('/v1/user/info/<username>')
@login_required
@limiter.exempt
def get_user_info(username):
    """Return information of specific user"""
    if username == session['user']:
        return jsonify({'message': 'Not applicable'}), 400

    user_id = sdb.get_user_id(username)
    
    if user_id is None:
        return jsonify({'message': 'User not found'}), 404

    return jsonify({
        'username': username,
        'credits': sdb.get_user_credits(user_id)
    })

# Web Routes - History #################################################

@app.route('/v1/user/history')
@login_required
@limiter.exempt
def get_current_user_history():
    """Return complete history of current user's activities"""
    history = sdb.get_user_history(session['user_id'])
    
    return jsonify({'history': history})

@app.route('/v1/user/history/<username>')
@login_required
@limiter.exempt
def get_user_history(username):
    """Return complete history of specific user's activities"""
    if username == session['user']:
        return jsonify({'message': 'Not applicable'}), 400

    user_id = sdb.get_user_id(username)
    if user_id is None:
        return jsonify({'message': 'User not found'}), 404

    history = sdb.get_user_history(user_id)
    
    return jsonify({'history': history})

# Web Routes - Gallery ##################################################

@app.route('/v1/user/gallery')
@login_required
@limiter.exempt
def get_current_user_gallery():
    """Return gallery of current user with image URLs"""
    gallery = sdb.get_user_gallery(session['user_id'])
    
    return jsonify({'gallery': gallery})

@app.route('/v1/user/gallery/<username>')
@login_required
@limiter.exempt
def get_user_gallery(username):
    """Return gallery of specific user with image URLs"""
    if username == session['user']:
        return jsonify({'message': 'Not applicable'}), 400
        
    user_id = sdb.get_user_id(username)
    
    if user_id is None:
        return jsonify({'message': 'User not found'}), 404

    gallery = sdb.get_user_gallery(user_id)
    return jsonify({'gallery': gallery})

# Web Routes - Username Management #######################################

@app.route('/v1/user/username/update', methods=['POST'])
@login_required
def update_username():
    """Update username after password verification"""
    user_id = session['user_id']
    current_password = request.json.get('current_password')
    new_username = request.json.get('new_username')
    
    # Verify current password
    if not sdb.check_user(session['user'], current_password):
        return jsonify({
            'success': False,
            'message': 'Current password is incorrect'
        })
    
    # Update username in database
    if sdb.update_username(user_id, new_username):
        # Update session with new username
        session['user'] = new_username
        return jsonify({
            'success': True,
            'message': 'Username updated successfully'
        })
    
    return jsonify({
        'success': False,
        'message': 'Username already exists or update failed'
    })

# Web Routes - User Deletion ###########################################

@app.route('/v1/user/delete', methods=['POST'])
@login_required
def delete_account():
    """Delete user account after password verification"""
    user_id = session['user_id']
    current_password = request.json.get('current_password')
    
    # Verify current password
    if not sdb.check_user(session['user'], current_password):
        return jsonify({
            'success': False,
            'message': 'Password is incorrect'
        })
    
    # Delete account from database
    if sdb.delete_user(user_id):
        session.clear()
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        })
    
    return jsonify({
        'success': False,
        'message': 'Failed to delete account'
    })
    
# Web Routes - Clear History ###########################################

@app.route('/v1/user/history/clear', methods=['POST'])
@login_required
def clear_history():
    """Clear user's history after password verification"""
    user_id = session['user_id']
    current_password = request.json.get('current_password')
    
    # Verify current password
    if not sdb.check_user(session['user'], current_password):
        return jsonify({
            'success': False,
            'message': 'Password is incorrect'
        })
    
    # Clear user history
    if sdb.clear_user_history(user_id):
        # Add to history
        sdb.add_user_history(
            user_id=user_id,
            type='User Actions',
            task='Clear History',
            detail='All previous user history has been deleted',
            status='success',
            timestamp=get_current_timestamp()
        )
        return jsonify({
            'success': True,
            'message': 'History cleared successfully'
        })
    
    return jsonify({
        'success': False,
        'message': 'Failed to clear history'
    })

# Web Routes - Archive #################################################

@app.route('/v1/user/archive/create', methods=['POST'])
@login_required
def create_archive():
    """Create ZIP archive of user's gallery images"""
    user_id = session['user_id']
    password = request.json.get('current_password')
    
    if not sdb.check_user(session['user'], password):
        return jsonify({
            'success': False,
            'message': 'Password is incorrect!'
        })
    
    download_id = f"{session['user']}_{str(uuid.uuid4())}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}"
    
    # Use system temp directory instead of custom folder
    zip_path = os.path.join(tempfile.gettempdir(), f'{download_id}.zip')
    
    gallery = sdb.get_user_gallery(user_id)
    
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for _, _, _, timestamp, result_url in gallery:
            if result_url:
                file_path = os.path.join(sap.save_dir, decode_image_path(result_url.split('/')[-1]))
                if os.path.exists(file_path):
                    filename = f"{timestamp.replace('/', '-').replace(':', '-')}_{os.path.basename(file_path)}"
                    zipf.write(file_path, filename)
    
    sdb.add_user_history(
        user_id=user_id,
        type='User Actions',
        task='Archive Download',
        detail=f'User downloaded their archive of {len(gallery)} generations',
        status='success',
        timestamp=get_current_timestamp()
    )
    
    def delete_zip():
        if os.path.exists(zip_path):
            os.remove(zip_path)
            
    Timer(600, delete_zip).start()  # Delete after 10 minutes
    
    return jsonify({
        'success': True,
        'download_id': download_id,
        'message': 'Archive created successfully!'
    })

@app.route('/v1/user/archive/download/<download_id>')
@login_required
def download_archive_file(download_id):
    """Serve created ZIP archive for download"""
    zip_path = os.path.join(tempfile.gettempdir(), f'{download_id}.zip')
    
    if os.path.exists(zip_path):
        download_name = f'{session["user"]}_{datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}_gallery.zip'
        return send_file(zip_path, as_attachment=True, download_name=download_name)
    
    return 'File not found', 404

# Web Routes - Authentication/Password Management #######################

@app.route('/v1/user/password/update', methods=['POST'])
@login_required
def update_password():
    """Update user's password after verification"""
    user_id = session['user_id']
    current_password = request.json.get('current_password')
    new_password = request.json.get('new_password')
    
    # Verify current password
    if not sdb.check_user(session['user'], current_password):
        return jsonify({
            'success': False,
            'message': 'Current password is incorrect'
        })
    
    # Update password in database
    if sdb.update_password(user_id, new_password):

        sdb.add_user_history(
            user_id=user_id,
            type='User Actions',
            task='Password Changed',
            detail='User changed their password',
            status='success',
            timestamp=get_current_timestamp()
        )
        return jsonify({
            'success': True,
            'message': 'Password updated successfully'
        })
    
    return jsonify({
        'success': False,
        'message': 'Failed to update password'
    })

@app.route('/v1/user/password/reset', methods=['POST'])
@limiter.limit("10 per minute")
def reset_password():
    """Reset password using recovery key"""
    username = request.json.get('username')
    recovery_key = request.json.get('recovery_key')
    new_password = request.json.get('new_password')
    
    user_id = sdb.verify_recovery_key(username, recovery_key)
    if user_id:
        if sdb.update_password(user_id, new_password):

            sdb.add_user_history(
                user_id=user_id,
                type='User Actions',
                task='Password Reset',
                detail='User has reset their password',
                status='success',
                timestamp=get_current_timestamp()
            )
            
            return jsonify({
                'success': True,
                'message': 'Password reset successful'
            })
    return jsonify({
        'success': False,
        'message': 'Invalid username or recovery key'
    })

@app.route('/v1/user/password/recovery', methods=['POST'])
@limiter.limit("10 per minute")
@login_required
def get_recovery_key():
    """Retrieve account recovery key after password verification"""
    user_id = session['user_id']
    password = request.json.get('password')
    
    recovery_key = sdb.get_recovery_key(user_id, password)
    if recovery_key:
        return jsonify({
            'success': True,
            'recovery_key': recovery_key
        })
    return jsonify({
        'success': False,
        'message': 'Invalid password'
    })

@app.route('/v1/user/login', methods=['GET', 'POST'])
@limiter.limit("10 per minute")  # Limit login attempts
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user_id = sdb.check_user(username, password)
        
        if user_id:
            # Update last signin time
            sdb.update_last_signin(user_id)
            
            session.permanent = True  # Enable session expiration
            session['user'] = username
            session['user_id'] = user_id
            session['last_activity'] = datetime.now().isoformat()
            
            # Add to history
            sdb.add_user_history(
                user_id=user_id,
                type='User Actions',
                task='Login',
                detail='User logged in',
                status='success',
                timestamp=get_current_timestamp()
            )
            
            return jsonify({
                'success': True,
                'redirect': url_for('generator')
            })
        return jsonify({
            'success': False,
            'error': 'Username or password is incorrect!'
        })
    return render_template('index.html')

@app.route('/v1/user/register', methods=['GET', 'POST'])
@limiter.limit("10 per minute")
def register():
    """Register new user and generate recovery key"""
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        user_id = sdb.add_user(username, password)
        if user_id:
            # Generate and store recovery key
            recovery_key = sdb.generate_recovery_key()
            sdb.store_recovery_key(user_id, recovery_key)
            
            # Auto login after successful registration
            session['user'] = username
            session['user_id'] = user_id
            return jsonify({
                'success': True,
                'recovery_key': recovery_key,
                'message': 'Please save your recovery key before proceeding'
            })
        return jsonify({
            'success': False,
            'error': 'Username already exists'
        })
    return render_template('index.html')

@app.route('/v1/user/logout')
@login_required
def logout():
    """Clear user session and redirect to login"""
    session.pop('user', None)
    return redirect(url_for('index'))

# Web Routes - Image Processing ###########################################

@app.route('/v1/atelier/generate', methods=['POST'])
@login_required
def generate_atelier(feature='Atelier Gen'):
    """Generate image using Atelier model"""
    user_id = session['user_id']

    prompt = request.form.get('prompt')
    negative = request.form.get('negative_prompt')
    size = request.form.get('size')
    model = request.form.get('model')
    style = request.form.get('style')
    seed = request.form.get('seed', None)
    
    detail = f"Style: {style} | Model: {model} | Size: {size} | Seed: {seed}"
    
    generator = sap.image_generator(
        prompt=prompt, 
        negative_prompt=negative, 
        image_size=size, 
        model_name=model, 
        style_name=style,
        image_seed=seed
    )
    
    result = generator

    if result is not None:
        status = 'success'
    else:
        status = 'failed'

    result_url = get_image_url(result) if result else None
    timestamp = get_current_timestamp()
    
    sdb.add_user_history(
        user_id=user_id, 
        type=feature, 
        task=prompt, 
        detail=detail,
        status=status, 
        timestamp=timestamp, 
        result_url=result_url
    )
    
    if result:
        increment_user_stats(user_id, 'atelier')
        return jsonify({
            'image_url': request.url_root.rstrip('/') + result_url,
            'credits': sdb.get_user_credits(user_id),
            'timestamp': timestamp,
            'seed': seed
        })
    else:
        return jsonify({'error': 'Image generation failed. Please try again.'}), 400

@app.route('/v1/atelier/guide', methods=['POST'])
@login_required
def guide_image(feature='Atelier Guide'):
    """Process image guidance request with Atelier"""
    user_id = session['user_id']
    
    image = request.files['image']
    prompt = request.form.get('prompt')
    negative = request.form.get('negative_prompt')
    size = request.form.get('size')
    model = request.form.get('model')
    style = request.form.get('style')
    guide = request.form.get('guide_type')
    lora = request.form.get('lora')
    strength = request.form.get('strength')
    seed = request.form.get('seed', None)
    
    detail = f"Style: {style} | Model: {model} | Size: {size} | Strength: {strength} | Guidance: {guide} | Lora: {lora} | Seed: {seed}"

    temp_file_path = get_temp_file_path()
    image.save(temp_file_path)
    
    generator = sap.image_guidance(
        guide_image=temp_file_path, 
        guide_type=guide,
        prompt=prompt,
        negative_prompt=negative,
        image_size=size,
        model_name=model,
        guide_strength=strength,
        style_v4=lora,
        style_name=style,
        image_seed=seed
    )
    
    result = generator
    os.unlink(temp_file_path)
    
    if result is not None:
        status = 'success'
    else:
        status = 'failed'
        
    result_url = get_image_url(result) if result else None
    timestamp = get_current_timestamp()
    
    sdb.add_user_history(
        user_id=user_id, 
        type=feature, 
        task=prompt if prompt else 'No Prompt Provided', 
        detail=detail,
        status=status, 
        timestamp=timestamp, 
        result_url=result_url
    )

    if result is not None:
        increment_user_stats(user_id, 'guide')
        return jsonify({
            'image_url': request.url_root.rstrip('/') + result_url,
            'credits': sdb.get_user_credits(user_id),
            'timestamp': timestamp,
            'seed': seed
        })
    else:
        return jsonify({'error': 'Image guidance failed. Please try again.'}), 400


@app.route('/v1/legacy/upscale', methods=['POST'])
@login_required
def upscale_image(feature='Upscaler'):
    """Upscale uploaded image"""
    user_id = session['user_id']
    
    image = request.files['image']
    prompt = "User uploaded image"
    original_res = request.form.get('originalRes', 'Unknown')
    detail = f"Original resolution: {original_res}"
    
    temp_file_path = get_temp_file_path()
    image.save(temp_file_path)
    
    generator = sap.image_upscaler(
        image=temp_file_path
    )
    
    try:
        result = next(generator)
    except StopIteration:
        result = None
    except Exception as e:
        print(f"Error upscaling image: {e}")
        result = None
        
    os.unlink(temp_file_path) 
    
    if result is not None:
        with Image.open(result) as img:
            upscaled_res = f"{img.width} x {img.height}"
            detail = f"{detail} | Upscaled resolution: {upscaled_res}"
            status = 'success'
    else:
        status = 'failed'
    
    result_url = get_image_url(result) if result else None
    timestamp = get_current_timestamp()

    sdb.add_user_history(
        user_id=user_id,
        type=feature, 
        task=prompt, 
        detail=detail,
        status=status, 
        timestamp=timestamp, 
        result_url=result_url
    )
    
    if result:
        increment_user_stats(user_id, 'upscale')
        return jsonify({
            'image_url': request.url_root.rstrip('/') + result_url,
            'credits': sdb.get_user_credits(user_id),
            'timestamp': timestamp
        })
    else:
        return jsonify({'error': 'Image upscale failed. Please try again.'}), 400

# Web Routes - Page Rendering ###########################################

@app.route('/')
def index():
    """Render login page or redirect to generator"""
    if 'user' in session:
        return redirect(url_for('generator'))
    return render_template('index.html')

@app.route('/status')
def status():
    """Render status page"""
    return render_template('status.html')

@app.route('/generator')
@login_required
def generator():
    """Render generator page"""
    return render_template('generator.html')

@app.route('/upscaler')
@login_required
def upscaler():
    """Render upscaler page"""
    return render_template('upscaler.html')

@app.route('/history')
@login_required
def user_history_page():
    """Render history page"""
    return render_template('history.html')

@app.route('/topup')
@login_required
def topup_page():
    """Render credit top-up page"""
    return render_template('topup.html')

@app.route('/variation')
@login_required
def variation():
    """Render variation page"""
    return render_template('variation.html')

@app.route('/gallery')
@login_required
def gallery():
    """Render gallery page"""
    return render_template('gallery.html')

@app.route('/settings')
@login_required
def settings():
    """Render settings page"""
    return render_template('settings.html')

@app.route('/atelier')
@login_required
def atelier():
    """Render Atelier page"""
    return render_template('atelier.html')

@app.route('/guide')
@login_required
def guide():
    """Render guidance page"""
    return render_template('guide.html')

@app.route('/public')
@login_required
def public():
    """Render public gallery page"""
    return render_template('public.html')

# Main Entry Point #######################################################

if __name__ == '__main__':
    app.run(debug=True)
