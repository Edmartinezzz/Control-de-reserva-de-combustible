from flask import Flask, jsonify, request, g, make_response
from flask_cors import CORS, cross_origin
import sqlite3
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu_clave_secreta_muy_segura'  # En producción, usa una variable de entorno

# Ruta raíz para health check
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'online',
        'message': 'API de Despacho Gas+ funcionando correctamente',
        'version': '1.0.0'
    })

# Obtener origen permitido desde variable de entorno (para producción)
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',')

# Configuración CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
}, supports_credentials=True)

# Manejar solicitudes OPTIONS
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers.add('Access-Control-Allow-Origin', origin)
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Configuración de la base de datos
def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect('gas_delivery.db')
        g.db.row_factory = sqlite3.Row
    return g.db

# Inicializar la base de datos
def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        
        # Crear tablas si no existen
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT UNIQUE NOT NULL,
                contrasena TEXT NOT NULL,
                nombre TEXT NOT NULL,
                es_admin BOOLEAN DEFAULT 0
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                direccion TEXT,
                telefono TEXT,
                litros_mes REAL DEFAULT 0,
                litros_disponibles REAL DEFAULT 0,
                activo BOOLEAN DEFAULT 1
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS retiros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER NOT NULL,
                fecha TEXT NOT NULL,
                hora TEXT NOT NULL,
                litros REAL NOT NULL,
                usuario_id INTEGER NOT NULL,
                FOREIGN KEY (cliente_id) REFERENCES clientes (id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
            )
        ''')
        
        # Crear o actualizar usuario admin
        admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
        
        cursor.execute('SELECT * FROM usuarios WHERE usuario = ?', ('admin',))
        if cursor.fetchone():
            # Si existe, actualizar contraseña
            cursor.execute(
                'UPDATE usuarios SET contrasena = ? WHERE usuario = ?',
                (admin_password, 'admin')
            )
            print(f"Usuario admin actualizado con contraseña configurada")
        else:
            # Si no existe, crear
            cursor.execute(
                'INSERT INTO usuarios (usuario, contrasena, nombre, es_admin) VALUES (?, ?, ?, ?)',
                ('admin', admin_password, 'Administrador', 1)
            )
            print(f"Usuario admin creado con contraseña configurada")
        
        db.commit()

# Decorador para verificar el token JWT
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token no proporcionado'}), 403
        try:
            data = jwt.decode(token.split()[1], app.config['SECRET_KEY'], algorithms=['HS256'])
            g.usuario_actual = data['usuario']
            g.usuario_id = data['id']
            g.es_admin = data['es_admin']
        except:
            return jsonify({'message': 'Token inválido'}), 403
        return f(*args, **kwargs)
    return decorated

# Rutas de autenticación
@app.route('/api/login', methods=['POST', 'OPTIONS'])
@cross_origin(origins=['http://localhost:3000', 'http://localhost:3001'], 
              methods=['POST', 'OPTIONS'],
              allow_headers=['Content-Type', 'Authorization'],
              supports_credentials=True)
def login():
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response

    try:
        data = request.get_json()
        if not data or 'usuario' not in data or 'contrasena' not in data:
            return jsonify({'error': 'Se requieren usuario y contraseña'}), 400
            
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('SELECT * FROM usuarios WHERE usuario = ?', (data.get('usuario'),))
        usuario = cursor.fetchone()
        
        if not usuario or usuario['contrasena'] != data.get('contrasena'):
            return jsonify({'error': 'Usuario o contraseña incorrectos'}), 401
        
        # Crear token JWT
        token = jwt.encode({
            'usuario': usuario['usuario'],
            'id': usuario['id'],
            'es_admin': bool(usuario['es_admin']),
            'exp': datetime.utcnow() + timedelta(hours=8)
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        response = jsonify({
            'token': token,
            'usuario': {
                'id': usuario['id'],
                'usuario': usuario['usuario'],
                'nombre': usuario['nombre'],
                'es_admin': bool(usuario['es_admin'])
            }
        })
        
        # Configurar la cookie de sesión
        response.set_cookie(
            'token', 
            token,
            httponly=True,
            samesite='Lax',
            secure=False,  # En producción, establecer a True
            max_age=8 * 60 * 60  # 8 horas
        )
        
        return response
        
    except Exception as e:
        print(f"Error en el login: {str(e)}")
        return jsonify({'error': 'Error en el servidor'}), 500

# Rutas de clientes
@app.route('/api/clientes', methods=['GET'])
@token_required
def obtener_clientes():
    db = get_db()
    cursor = db.cursor()
    
    busqueda = request.args.get('busqueda', '')
    query = 'SELECT * FROM clientes WHERE activo = 1'
    params = []
    
    if busqueda:
        query += ' AND (nombre LIKE ? OR direccion LIKE ?)'
        search_term = f'%{busqueda}%'
        params.extend([search_term, search_term])
    
    cursor.execute(query, params)
    clientes = [dict(row) for row in cursor.fetchall()]
    return jsonify(clientes)

@app.route('/api/clientes/<int:cliente_id>', methods=['GET'])
@token_required
def obtener_cliente(cliente_id):
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('''
        SELECT c.*, 
               (SELECT SUM(litros) FROM retiros 
                WHERE cliente_id = c.id 
                AND date('now', 'start of month') <= date(fecha) 
                AND date(fecha) <= date('now', 'start of month', '+1 month', '-1 day')) as litros_retirados_mes
        FROM clientes c 
        WHERE c.id = ? AND c.activo = 1
    ''', (cliente_id,))
    
    cliente = cursor.fetchone()
    if not cliente:
        return jsonify({'error': 'Cliente no encontrado'}), 404
    
    return jsonify(dict(cliente))

@app.route('/api/clientes', methods=['POST'])
@token_required
def crear_cliente():
    if not g.es_admin:
        return jsonify({'error': 'No autorizado'}), 403
        
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO clientes (nombre, direccion, telefono, litros_mes, litros_disponibles)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            data.get('nombre'),
            data.get('direccion'),
            data.get('telefono'),
            data.get('litros_mes', 0),
            data.get('litros_mes', 0)  # Inicialmente, los litros disponibles son iguales al límite mensual
        ))
        
        db.commit()
        return jsonify({'id': cursor.lastrowid}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

# Rutas de retiros
@app.route('/api/retiros', methods=['POST'])
@token_required
def registrar_retiro():
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Verificar si el cliente existe y tiene saldo suficiente
        cursor.execute('SELECT * FROM clientes WHERE id = ? AND activo = 1', (data.get('cliente_id'),))
        cliente = cursor.fetchone()
        
        if not cliente:
            return jsonify({'error': 'Cliente no encontrado'}), 404
            
        litros = float(data.get('litros', 0))
        
        # Verificar saldo disponible
        if litros <= 0:
            return jsonify({'error': 'La cantidad debe ser mayor a cero'}), 400
            
        # Verificar saldo disponible (opcional, dependiendo de la lógica de negocio)
        # if cliente['litros_disponibles'] < litros:
        #     return jsonify({'error': 'Saldo insuficiente'}), 400
        
        # Registrar el retiro
        cursor.execute('''
            INSERT INTO retiros (cliente_id, fecha, hora, litros, usuario_id)
            VALUES (?, date('now'), time('now'), ?, ?)
        ''', (data.get('cliente_id'), litros, g.usuario_id))
        
        # Actualizar el saldo del cliente (opcional)
        # cursor.execute('''
        #     UPDATE clientes 
        #     SET litros_disponibles = litros_disponibles - ? 
        #     WHERE id = ?
        # ''', (litros, data.get('cliente_id')))
        
        db.commit()
        return jsonify({'mensaje': 'Retiro registrado exitosamente'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400

# Ruta para obtener el historial de retiros
@app.route('/api/retiros', methods=['GET'])
@token_required
def obtener_retiros():
    cliente_id = request.args.get('cliente_id')
    fecha_inicio = request.args.get('fecha_inicio')
    fecha_fin = request.args.get('fecha_fin')
    
    db = get_db()
    cursor = db.cursor()
    
    query = '''
        SELECT r.*, c.nombre as cliente_nombre, u.nombre as usuario_nombre 
        FROM retiros r
        JOIN clientes c ON r.cliente_id = c.id
        JOIN usuarios u ON r.usuario_id = u.id
        WHERE 1=1
    '''
    params = []
    
    if cliente_id:
        query += ' AND r.cliente_id = ?'
        params.append(cliente_id)
        
    if fecha_inicio:
        query += ' AND r.fecha >= ?'
        params.append(fecha_inicio)
        
    if fecha_fin:
        query += ' AND r.fecha <= ?'
        params.append(fecha_fin)
    
    query += ' ORDER BY r.fecha DESC, r.hora DESC'
    
    cursor.execute(query, params)
    retiros = [dict(row) for row in cursor.fetchall()]
    return jsonify(retiros)

# Inicializar la base de datos
with app.app_context():
    init_db()

if __name__ == '__main__':
    # Puerto dinámico para producción (Railway usa PORT)
    port = int(os.environ.get('PORT', 5000))
    # En producción, host debe ser 0.0.0.0 para aceptar conexiones externas
    host = os.environ.get('HOST', '0.0.0.0')
    # Debug solo en desarrollo
    is_dev = os.environ.get('FLASK_ENV', 'development') == 'development'
    
    print(f"Servidor Flask iniciado en http://{host}:{port}")
    app.run(host=host, port=port, debug=is_dev)
