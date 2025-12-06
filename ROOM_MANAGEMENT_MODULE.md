# Room Management Module

A reusable Flask + Socket.IO room system with automatic cleanup, connection tracking, and multi-room support.

**Extracted from:** FlickTimer Tournament Timer App  
**Features:**
- Unique room codes (e.g., `ROOM-A3X7`)
- Automatic cleanup of inactive rooms
- Connection tracking per room
- Warning notifications before room expiration
- Keep-alive pings to prevent timeout
- Room stats API

---

## Quick Start

### Dependencies

```txt
Flask>=2.0.0
Flask-SocketIO>=5.0.0
python-socketio>=5.0.0
eventlet>=0.30.0
```

---

## 1. Core Configuration & Storage

Add to top of your `app.py` or create a separate `rooms.py`:

```python
import time
import random
import string
import threading
from flask import Flask, redirect, url_for, request, jsonify, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room

# ============================================
# ROOM CONFIGURATION
# ============================================
ROOM_INACTIVITY_TIMEOUT = 2 * 60 * 60  # 2 hours in seconds
ROOM_WARNING_TIME = 10 * 60            # Warn 10 min before cleanup
CLEANUP_INTERVAL = 5 * 60              # Check every 5 minutes
MAX_ROOMS = 100                        # Maximum concurrent rooms

# ============================================
# ROOM STORAGE (in-memory)
# ============================================
rooms = {}              # room_code -> room_state dict
room_connections = {}   # room_code -> connection count

# Cleanup thread control
cleanup_thread = None
cleanup_running = False

# Flask app setup
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
socketio = SocketIO(app, cors_allowed_origins="*")
```

---

## 2. Room Code Generation

```python
def generate_room_code(prefix="ROOM"):
    """
    Generate a unique room code like 'ROOM-A3X7'
    
    Args:
        prefix: String prefix for the code (default: "ROOM")
    
    Returns:
        Unique room code string
    """
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        room_code = f"{prefix}-{code}"
        if room_code not in rooms:
            return room_code
```

---

## 3. Default Room State

**⚠️ CUSTOMIZE THIS for your app's needs:**

```python
def create_default_room_state():
    """
    Create a fresh state for a new room.
    
    CUSTOMIZE: Replace the app-specific fields with your own data structure.
    KEEP: The room management metadata fields at the bottom.
    
    Returns:
        Dictionary with initial room state
    """
    now = time.time()
    return {
        # ============================================
        # YOUR APP-SPECIFIC STATE (customize these)
        # ============================================
        'name': 'New Room',
        'status': 'waiting',
        'data': {},
        'settings': {
            'option1': True,
            'option2': 'default'
        },
        
        # ============================================
        # ROOM MANAGEMENT METADATA (keep these)
        # ============================================
        'created_at': now,
        'last_activity': now,
        'warning_sent': False,
    }
```

---

## 4. Room Helper Functions

```python
def touch_room(room_code):
    """
    Update the last activity timestamp for a room.
    
    IMPORTANT: Call this on every user action to prevent room expiration!
    
    Args:
        room_code: The room code to update
    """
    if room_code in rooms:
        rooms[room_code]['last_activity'] = time.time()
        rooms[room_code]['warning_sent'] = False  # Reset warning on activity


def get_room_age(room_code):
    """
    Get how long a room has been inactive.
    
    Args:
        room_code: The room code to check
    
    Returns:
        Seconds since last activity (0 if room doesn't exist)
    """
    if room_code not in rooms:
        return 0
    return time.time() - rooms[room_code].get('last_activity', time.time())


def get_room(room_code):
    """
    Get room state, creating the room if it doesn't exist.
    Automatically enforces MAX_ROOMS limit.
    
    Args:
        room_code: The room code to get/create
    
    Returns:
        Room state dictionary
    """
    if room_code not in rooms:
        # Enforce room limit by removing oldest inactive room
        if len(rooms) >= MAX_ROOMS:
            oldest = min(rooms.keys(), key=lambda k: rooms[k].get('last_activity', 0))
            if room_connections.get(oldest, 0) == 0:
                del rooms[oldest]
                room_connections.pop(oldest, None)
                print(f"[Rooms] Removed oldest room {oldest} to make space")
        
        rooms[room_code] = create_default_room_state()
        room_connections[room_code] = 0
    
    return rooms[room_code]


def broadcast_state(room_code):
    """
    Broadcast current room state to all connected clients.
    
    Call this after any state change!
    
    Args:
        room_code: The room to broadcast to
    """
    if room_code in rooms:
        state = rooms[room_code].copy()
        state['room_code'] = room_code
        socketio.emit('state_update', state, room=room_code)
```

---

## 5. Background Cleanup Thread

```python
def cleanup_inactive_rooms():
    """
    Background thread that periodically cleans up inactive rooms.
    
    - Sends warnings to rooms approaching timeout
    - Deletes rooms that have been inactive too long
    - Logs cleanup activity
    """
    global cleanup_running
    
    while cleanup_running:
        try:
            now = time.time()
            rooms_to_delete = []
            rooms_to_warn = []
            
            for room_code, state in list(rooms.items()):
                last_activity = state.get('last_activity', now)
                inactive_time = now - last_activity
                connections = room_connections.get(room_code, 0)
                
                # Skip rooms with active connections and recent activity
                if connections > 0 and inactive_time < ROOM_INACTIVITY_TIMEOUT:
                    continue
                
                # Check if room should be deleted
                if inactive_time >= ROOM_INACTIVITY_TIMEOUT:
                    rooms_to_delete.append(room_code)
                # Check if room should receive warning
                elif (inactive_time >= ROOM_INACTIVITY_TIMEOUT - ROOM_WARNING_TIME 
                      and not state.get('warning_sent', False)):
                    rooms_to_warn.append(room_code)
            
            # Send warnings to rooms about to expire
            for room_code in rooms_to_warn:
                if room_code in rooms:
                    rooms[room_code]['warning_sent'] = True
                    remaining = int((ROOM_INACTIVITY_TIMEOUT - get_room_age(room_code)) / 60)
                    socketio.emit('room_warning', {
                        'message': f'This room will close in ~{remaining} minutes due to inactivity.',
                        'minutes_remaining': remaining
                    }, room=room_code)
                    print(f"[Cleanup] Warning sent to {room_code}: {remaining} min remaining")
            
            # Delete expired rooms
            for room_code in rooms_to_delete:
                if room_code in rooms:
                    # Notify connected clients
                    socketio.emit('room_closed', {
                        'message': 'This room has been closed due to inactivity.',
                        'reason': 'inactivity'
                    }, room=room_code)
                    
                    # Remove room data
                    del rooms[room_code]
                    room_connections.pop(room_code, None)
                    print(f"[Cleanup] Deleted inactive room: {room_code}")
            
            # Log stats
            if rooms:
                total_connections = sum(room_connections.values())
                print(f"[Cleanup] Active rooms: {len(rooms)}, Connections: {total_connections}")
        
        except Exception as e:
            print(f"[Cleanup] Error: {e}")
        
        time.sleep(CLEANUP_INTERVAL)


def start_cleanup_thread():
    """Start the background cleanup thread (call once on first connection)"""
    global cleanup_thread, cleanup_running
    
    if cleanup_thread is None or not cleanup_thread.is_alive():
        cleanup_running = True
        cleanup_thread = threading.Thread(target=cleanup_inactive_rooms, daemon=True)
        cleanup_thread.start()
        print("[Cleanup] Background cleanup thread started")


def stop_cleanup_thread():
    """Stop the cleanup thread (optional, for graceful shutdown)"""
    global cleanup_running
    cleanup_running = False
```

---

## 6. Flask Routes

```python
@app.route('/')
def lobby():
    """Room selection/lobby page"""
    return render_template('lobby.html')


@app.route('/create-room', methods=['POST'])
def create_room():
    """Create a new room and redirect to it"""
    room_code = generate_room_code()
    rooms[room_code] = create_default_room_state()
    return redirect(url_for('room_view', room_code=room_code))


@app.route('/join-room', methods=['POST'])
def join_room_route():
    """Join an existing room (creates if doesn't exist)"""
    room_code = request.form.get('room_code', '').upper().strip()
    
    # Normalize room code format if needed
    # if not room_code.startswith('ROOM-'):
    #     room_code = f"ROOM-{room_code}"
    
    if room_code not in rooms:
        rooms[room_code] = create_default_room_state()
    
    return redirect(url_for('room_view', room_code=room_code))


@app.route('/room/<room_code>')
def room_view(room_code):
    """Main room view"""
    room_code = room_code.upper()
    get_room(room_code)  # Ensure room exists
    return render_template('room.html', room_code=room_code)


@app.route('/api/rooms', methods=['GET'])
def list_rooms_api():
    """
    API endpoint to list all active rooms with stats.
    
    Useful for:
    - Admin dashboards
    - Debugging
    - Monitoring
    """
    now = time.time()
    room_list = []
    
    for code, state in rooms.items():
        inactive_seconds = now - state.get('last_activity', now)
        room_list.append({
            'code': code,
            'name': state.get('name', 'Unnamed'),
            'connections': room_connections.get(code, 0),
            'created_at': state.get('created_at', now),
            'last_activity': state.get('last_activity', now),
            'inactive_minutes': int(inactive_seconds / 60),
            'expires_in_minutes': max(0, int((ROOM_INACTIVITY_TIMEOUT - inactive_seconds) / 60))
        })
    
    return jsonify({
        'rooms': room_list,
        'total_rooms': len(rooms),
        'max_rooms': MAX_ROOMS,
        'inactivity_timeout_hours': ROOM_INACTIVITY_TIMEOUT / 3600
    })
```

---

## 7. Socket.IO Event Handlers

```python
@socketio.on('connect')
def handle_connect():
    """Handle new WebSocket connection"""
    start_cleanup_thread()  # Ensure cleanup is running


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    pass  # Cleanup is handled by 'leave' event


@socketio.on('join')
def handle_join(data):
    """
    Handle client joining a room.
    
    Expected data: { room_code: 'ROOM-XXXX' }
    """
    room_code = data.get('room_code', '').upper()
    if room_code:
        # Track connection
        if room_code not in room_connections:
            room_connections[room_code] = 0
        room_connections[room_code] += 1
        
        # Update activity and join Socket.IO room
        touch_room(room_code)
        join_room(room_code)
        
        # Send current state to the joining client
        state = get_room(room_code).copy()
        state['room_code'] = room_code
        emit('state_update', state)


@socketio.on('leave')
def handle_leave(data):
    """
    Handle client leaving a room.
    
    Expected data: { room_code: 'ROOM-XXXX' }
    """
    room_code = data.get('room_code', '').upper()
    if room_code:
        leave_room(room_code)
        # Decrement connection count
        if room_code in room_connections:
            room_connections[room_code] = max(0, room_connections[room_code] - 1)


@socketio.on('keep_alive')
def handle_keep_alive(data):
    """
    Handle keep-alive ping to prevent room timeout.
    
    Expected data: { room_code: 'ROOM-XXXX' }
    """
    room_code = data.get('room_code', '').upper()
    if room_code and room_code in rooms:
        touch_room(room_code)


# ============================================
# ADD YOUR APP-SPECIFIC SOCKET HANDLERS HERE
# ============================================
# Example:
# @socketio.on('update_data')
# def handle_update(data):
#     room_code = data.get('room_code', '').upper()
#     if room_code and room_code in rooms:
#         touch_room(room_code)
#         rooms[room_code]['data'] = data.get('data', {})
#         broadcast_state(room_code)
```

---

## 8. Client-Side JavaScript

Include in your room template:

```html
<body data-room-code="{{ room_code }}">
    <!-- Your room UI here -->
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.2/socket.io.min.js"></script>
    <script>
        // ============================================
        // ROOM CONNECTION SETUP
        // ============================================
        const socket = io();
        const roomCode = document.body.dataset.roomCode;
        
        // Join room on connect
        socket.on('connect', () => {
            console.log('Connected to server');
            socket.emit('join', { room_code: roomCode });
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        // ============================================
        // ROOM STATE UPDATES
        // ============================================
        socket.on('state_update', (state) => {
            console.log('Room state:', state);
            // UPDATE YOUR UI HERE with the new state
            // Example:
            // document.getElementById('room-name').textContent = state.name;
        });
        
        // ============================================
        // ROOM LIFECYCLE EVENTS
        // ============================================
        socket.on('room_warning', (data) => {
            console.warn('Room warning:', data.message);
            // Show warning notification to user
            alert(data.message);
        });
        
        socket.on('room_closed', (data) => {
            console.warn('Room closed:', data.message);
            alert(data.message);
            // Redirect to lobby
            window.location.href = '/';
        });
        
        // ============================================
        // KEEP-ALIVE (prevents room timeout)
        // ============================================
        const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
        
        setInterval(() => {
            if (socket.connected) {
                socket.emit('keep_alive', { room_code: roomCode });
            }
        }, KEEP_ALIVE_INTERVAL);
        
        // ============================================
        // HELPER: Emit events to room
        // ============================================
        function emitToRoom(event, data = {}) {
            socket.emit(event, { room_code: roomCode, ...data });
        }
        
        // Example usage:
        // emitToRoom('update_data', { data: { key: 'value' } });
    </script>
</body>
```

---

## 9. Lobby Template (`lobby.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Room Lobby</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 2rem auto;
            padding: 1rem;
        }
        .card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        }
        input {
            padding: 0.75rem;
            font-size: 1rem;
            width: 100%;
            margin-bottom: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }
        button {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            cursor: pointer;
            border: none;
            border-radius: 4px;
            width: 100%;
        }
        .btn-primary { background: #007bff; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        button:hover { opacity: 0.9; }
    </style>
</head>
<body>
    <h1>Room Lobby</h1>
    
    <div class="card">
        <h2>Create New Room</h2>
        <form action="/create-room" method="POST">
            <button type="submit" class="btn-primary">Create Room</button>
        </form>
    </div>
    
    <div class="card">
        <h2>Join Existing Room</h2>
        <form action="/join-room" method="POST">
            <input type="text" name="room_code" placeholder="ROOM-XXXX" required>
            <button type="submit" class="btn-secondary">Join Room</button>
        </form>
    </div>
</body>
</html>
```

---

## 10. Running the App

```python
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
```

---

## Quick Reference

| Function | Purpose |
|----------|---------|
| `generate_room_code()` | Create unique room code |
| `create_default_room_state()` | **CUSTOMIZE** - Your room's initial state |
| `get_room(code)` | Get/create room state |
| `touch_room(code)` | Update activity timestamp |
| `broadcast_state(code)` | Send state to all clients |
| `start_cleanup_thread()` | Start auto-cleanup |

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ROOM_INACTIVITY_TIMEOUT` | 2 hours | Time before room is deleted |
| `ROOM_WARNING_TIME` | 10 min | Warning time before deletion |
| `CLEANUP_INTERVAL` | 5 min | How often to check for stale rooms |
| `MAX_ROOMS` | 100 | Maximum concurrent rooms |

---

## Customization Checklist

- [ ] Change `generate_room_code()` prefix
- [ ] Customize `create_default_room_state()` with your data
- [ ] Add app-specific Socket.IO handlers
- [ ] Update templates for your UI
- [ ] Adjust timeout values if needed

