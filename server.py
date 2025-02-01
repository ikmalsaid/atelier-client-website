from flask import Flask, request, jsonify, render_template, redirect, url_for, session, send_file, send_from_directory
from flask_limiter.util import get_remote_address
from datetime import datetime, timedelta
from collections import OrderedDict
from flask_limiter import Limiter
from threading import Timer
from functools import wraps
from io import BytesIO
import tempfile
import zipfile
import base64
import time
import uuid
import os

from atelier_client import AtelierClient
from utils.database import Database
from utils.credits import Credits

app = Flask(__name__)
app.secret_key = 'xxxxxx'

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri="memory://"
    )

app.permanent_session_lifetime = timedelta(hours=1)

sap = AtelierClient(save_as='pil')
sdb = Database()
scr = Credits()

# Cost Information ###################################################

costs = {
    'atelier': 1
}

menus= OrderedDict([
    ('💰 Topup', "/topup"),
    ('🎨 Generator', "/generator"),
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
    styles = sap.list_atr_styles
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

@app.route('/v1/presets/atelier/models/svi')
@login_required
@limiter.exempt
def get_atelier_models_svi():
    """Return available Atelier model options"""
    models = sap.list_atr_models_svi
    return jsonify({'models': models})

@app.route('/v1/presets/atelier/lora/svi')
@login_required
@limiter.exempt
def get_atelier_lora_svi():
    """Return available Atelier LoRA styles"""
    lora = sap.list_atr_lora_svi
    return jsonify({'svi_loras': lora})

@app.route('/v1/presets/atelier/lora/flux')
@login_required
@limiter.exempt
def get_atelier_lora_flux():
    """Return available Atelier LoRA styles"""
    lora = sap.list_atr_lora_flux
    return jsonify({'flux_loras': lora})

@app.route('/v1/presets/menu')
@login_required
@limiter.exempt
def get_menu_items():
    """Return numbered menu items and their routes"""
    return jsonify({'menu_items': {f"{str(i).zfill(2)}. {k}":
        v for i, (k, v) in enumerate(menus.items(), 1)}})

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
    """Create ZIP archive of user's gallery base64 images"""
    user_id = session['user_id']
    password = request.json.get('current_password')
    
    if not sdb.check_user(session['user'], password):
        return jsonify({
            'success': False,
            'message': 'Password is incorrect!'
        })
    
    download_id = f"{session['user']}_{str(uuid.uuid4())}_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}"
    zip_path = os.path.join(tempfile.gettempdir(), f'{download_id}.zip')
    
    gallery = sdb.get_user_gallery(user_id)
    
    with zipfile.ZipFile(zip_path, 'w') as zipf:
        for _, _, _, timestamp, result_url in gallery:
            if result_url and result_url.startswith('data:image'):
                try:
                    # Extract the base64 data after the comma
                    base64_data = result_url.split(',')[1]
                    # Decode base64 to binary
                    image_data = base64.b64decode(base64_data)
                    filename = f"{timestamp.replace('/', '-').replace(':', '-').replace(' ', '_')}.webp"
                    # Write binary data directly to zip
                    zipf.writestr(filename, image_data)
                
                except Exception as e:
                    print(f"Error processing image: {e}")
                    continue
    
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

def __data_url_processor(pil_image) -> str:
    """Convert PIL Image to base64 data URL."""
    try:
        img_io = BytesIO()
        pil_image.save(img_io, format='WEBP', quality=90)
        img_io.seek(0)
        img_base64 = base64.b64encode(img_io.getvalue()).decode()
        
        sap.logger.info(f"Created data URL from PIL object!")
        return f"data:image/png;base64,{img_base64}"
    
    except Exception as e:
        sap.logger.error(f"Error in data_url_processor: {e}")
        return None

@app.route('/v1/atelier/generate', methods=['POST'])
@login_required
def generate_atelier(feature='Image Generator'):
    """
    Handle image generation requests via form data.

    Form Parameters:
    - prompt (str, required): User's positive prompt
    - negative_prompt (str, optional): User's negative prompt
    - model_name (str, optional): Name of the model to use (default: "flux-turbo")
    - image_size (str, optional): Desired image size ratio (default: "1:1")
    - lora_svi (str, optional): Name of the LoRA SVI preset (default: "none")
    - lora_flux (str, optional): Name of the LoRA Flux preset (default: "none")
    - image_seed (int, optional): Seed for image generation (default: 0)
    - style_name (str, optional): Name of the style preset (default: "none")
    """
    try:
        user_id = session['user_id']
        
        data = {
            'prompt': request.form.get('prompt'),
            'negative_prompt': request.form.get('negative_prompt', ''),
            'model_name': request.form.get('model_name', 'flux-turbo'),
            'image_size': request.form.get('image_size', '1:1'),
            'lora_svi': request.form.get('lora_svi', 'none'),
            'lora_flux': request.form.get('lora_flux', 'none'),
            'image_seed': request.form.get('image_seed', 0),
            'style_name': request.form.get('style_name', 'none')
        }
        
        task = data['prompt']
        detail = f"Style: {data['style_name']} | Model: {data['model_name']} | Size: {data['image_size']} | Seed: {data['image_seed']}"

        if not data['prompt']:
            raise Exception("Missing prompt")

        result = sap.image_generate(**data)
        if not result:
            raise Exception("Generation failed")

        data_url = __data_url_processor(result)
        if not data_url:
            raise Exception("Failed to process image")
        
        sdb.add_user_history(
            user_id=user_id, 
            type=feature, 
            task=task, 
            detail=detail,
            status='success', 
            timestamp=get_current_timestamp(), 
            result_url=data_url
        )
        
        increment_user_stats(user_id, 'atelier')

        return jsonify({
            "success": True, 
            "result": data_url,
            "credits": sdb.get_user_credits(user_id),
            "timestamp": get_current_timestamp(),
            "seed": data['image_seed']
        })

    except Exception as e:
        sap.logger.error(f"Error in image_generate_api: {e}")
        return jsonify({"success": False, "error": str(e)}), 400

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

@app.route('/generator')
@login_required
def generator():
    """Render Atelier page"""
    return render_template('generator.html')

# Main Entry Point #######################################################

if __name__ == '__main__':
    app.run(debug=True)
