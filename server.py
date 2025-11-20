from flask import Flask, jsonify, request, g, make_response
from flask_cors import CORS, cross_origin
import sqlite3
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get('DATA_DIR', '/data')

if DATA_DIR and os.path.isdir(DATA_DIR):
    DEFAULT_DB_PATH = os.path.join(DATA_DIR, 'gas_delivery.db')
else:
    DEFAULT_DB_PATH = os.path.join(BASE_DIR, 'gas_delivery.db')

DB_PATH = os.environ.get('DB_PATH', DEFAULT_DB_PATH)
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu_clave_secreta_muy_segura')  # En producción, usa una variable de entorno

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
        g.db = sqlite3.connect(DB_PATH)
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
                tipo_combustible TEXT DEFAULT 'gasoil',
                FOREIGN KEY (cliente_id) REFERENCES clientes (id),
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sistema_config (
                id INTEGER PRIMARY KEY CHECK(id = 1),
                retiros_bloqueados INTEGER NOT NULL DEFAULT 0,
                limite_diario_gasolina REAL DEFAULT 2000,
                fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS agendamientos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER NOT NULL,
                subcliente_id INTEGER,
                tipo_combustible TEXT NOT NULL DEFAULT 'gasolina',
                litros REAL NOT NULL,
                fecha_agendada TEXT NOT NULL,
                codigo_ticket INTEGER,
                estado TEXT NOT NULL DEFAULT 'pendiente',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes (id),
                FOREIGN KEY (subcliente_id) REFERENCES clientes (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS limites_diarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TEXT NOT NULL,
                tipo_combustible TEXT NOT NULL DEFAULT 'gasolina',
                litros_agendados REAL DEFAULT 0,
                litros_procesados REAL DEFAULT 0,
                UNIQUE(fecha, tipo_combustible)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS subclientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_padre_id INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                cedula TEXT,
                placa TEXT,
                litros_mes_gasolina REAL DEFAULT 0,
                litros_mes_gasoil REAL DEFAULT 0,
                litros_disponibles_gasolina REAL DEFAULT 0,
                litros_disponibles_gasoil REAL DEFAULT 0,
                activo BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_padre_id) REFERENCES clientes (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tipo_combustible TEXT NOT NULL CHECK(tipo_combustible IN ('gasoil', 'gasolina')),
                litros_ingresados REAL NOT NULL,
                litros_disponibles REAL NOT NULL,
                fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                usuario_id INTEGER,
                observaciones TEXT,
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
            )
        ''')
        
        # Inicializar configuración si no existe
        cursor.execute('SELECT * FROM sistema_config WHERE id = 1')
        if not cursor.fetchone():
            cursor.execute('INSERT INTO sistema_config (id, retiros_bloqueados) VALUES (1, 0)')
        
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
            
        # Migraciones: Agregar columnas faltantes si no existen
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN cedula TEXT UNIQUE')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN rif TEXT')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN placa TEXT')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN categoria TEXT DEFAULT "Persona Natural"')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN subcategoria TEXT')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN exonerado BOOLEAN DEFAULT 0')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN huella BOOLEAN DEFAULT 0')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN litros_mes_gasolina REAL DEFAULT 0')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN litros_mes_gasoil REAL DEFAULT 0')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN litros_disponibles_gasolina REAL DEFAULT 0')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE clientes ADD COLUMN litros_disponibles_gasoil REAL DEFAULT 0')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE retiros ADD COLUMN tipo_combustible TEXT DEFAULT "gasoil"')
        except: pass

        try:
            cursor.execute('ALTER TABLE retiros ADD COLUMN hora TEXT DEFAULT "00:00:00"')
            cursor.execute('UPDATE retiros SET hora = "00:00:00" WHERE hora IS NULL OR hora = ""')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE retiros ADD COLUMN codigo_ticket INTEGER')
        except: pass
        
        try:
            cursor.execute('ALTER TABLE sistema_config ADD COLUMN limite_diario_gasolina REAL DEFAULT 2000')
        except: pass
        
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

# Login de clientes (sin autenticación requerida)
@app.route('/api/clientes/login', methods=['POST'])
def login_cliente():
    try:
        data = request.json
        cedula = data.get('cedula')
        
        if not cedula:
            return jsonify({'error': 'La cédula es requerida'}), 400
        
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('SELECT * FROM clientes WHERE cedula = ? AND activo = 1', (cedula,))
        cliente = cursor.fetchone()
        
        if not cliente:
            return jsonify({'error': 'Cliente no encontrado o inactivo'}), 404
        
        cliente_dict = dict(cliente)
        
        # Generar token JWT
        token = jwt.encode(
            {
                'id': cliente_dict['id'],
                'nombre': cliente_dict['nombre'],
                'cedula': cliente_dict['cedula'],
                'tipo': 'cliente'
            },
            app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        
        # Devolver información del cliente
        return jsonify({
            'token': token,
            'cliente': {
                'id': cliente_dict['id'],
                'nombre': cliente_dict['nombre'],
                'cedula': cliente_dict['cedula'],
                'telefono': cliente_dict.get('telefono'),
                'categoria': cliente_dict.get('categoria'),
                'placa': cliente_dict.get('placa'),
                'litros_disponibles': cliente_dict.get('litros_disponibles', 0),
                'litros_mes': cliente_dict.get('litros_mes', 0),
                'litros_disponibles_gasolina': cliente_dict.get('litros_disponibles_gasolina', 0),
                'litros_disponibles_gasoil': cliente_dict.get('litros_disponibles_gasoil', 0),
                'litros_mes_gasolina': cliente_dict.get('litros_mes_gasolina', 0),
                'litros_mes_gasoil': cliente_dict.get('litros_mes_gasoil', 0)
            }
        })
    except Exception as e:
        print(f"Error en autenticación de cliente: {e}")
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
    cursor.execute(query, params)
    clientes = [dict(row) for row in cursor.fetchall()]
    return jsonify(clientes)

@app.route('/api/clientes/simple', methods=['GET'])
def obtener_clientes_simple():
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('''
            SELECT id, nombre, cedula, telefono, placa, categoria, subcategoria, 
                   litros_mes, litros_disponibles 
            FROM clientes 
            WHERE activo = 1 
            ORDER BY nombre ASC
        ''')
        clientes = [dict(row) for row in cursor.fetchall()]
        return jsonify(clientes)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clientes/lista', methods=['GET'])
@token_required
def obtener_clientes_lista():
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('''
            SELECT 
                c.id,
                c.nombre,
                c.cedula,
                c.telefono,
                c.placa,
                c.categoria,
                c.subcategoria,
                c.litros_mes,
                c.litros_disponibles,
                COUNT(r.id) as total_retiros,
                COALESCE(SUM(r.litros), 0) as total_litros_retirados,
                MAX(r.fecha) as ultimo_retiro
            FROM clientes c
            LEFT JOIN retiros r ON c.id = r.cliente_id
            WHERE c.activo = 1 
            GROUP BY c.id
            ORDER BY c.nombre ASC
        ''')
        
        clientes = []
        for row in cursor.fetchall():
            cliente = dict(row)
            clientes.append({
                'id': cliente['id'],
                'nombre': cliente['nombre'],
                'cedula': cliente['cedula'],
                'telefono': cliente['telefono'],
                'placa': cliente['placa'] or 'N/A',
                'categoria': cliente['categoria'],
                'subcategoria': cliente['subcategoria'] or 'N/A',
                'litros_mes': cliente['litros_mes'],
                'litros_disponibles': cliente['litros_disponibles'],
                'total_retiros': cliente['total_retiros'],
                'total_litros_retirados': cliente['total_litros_retirados'],
                'ultimo_retiro': cliente['ultimo_retiro']
            })
        
        return jsonify(clientes)
    except Exception as e:
        print(f"Error al obtener lista de clientes: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

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

@app.route('/api/clientes/<int:cliente_id>/tickets', methods=['GET'])
@token_required
def obtener_tickets_cliente(cliente_id):
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('''
            SELECT 
                r.id,
                r.litros,
                r.tipo_combustible,
                r.codigo_ticket,
                r.fecha,
                c.nombre as cliente_nombre,
                c.cedula as cliente_cedula,
                c.telefono as cliente_telefono,
                c.placa as cliente_placa,
                c.categoria as cliente_categoria
            FROM retiros r
            JOIN clientes c ON r.cliente_id = c.id
            WHERE r.cliente_id = ?
            ORDER BY r.fecha DESC
            LIMIT 50
        ''', (cliente_id,))
        
        tickets = [dict(row) for row in cursor.fetchall()]
        return jsonify(tickets)
    except Exception as e:
        print(f"Error al obtener tickets del cliente: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/clientes/telefono/<telefono>', methods=['GET'])
def obtener_cliente_por_telefono(telefono):
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('''
        SELECT c.*, 
               (SELECT SUM(litros) FROM retiros 
                WHERE cliente_id = c.id 
                AND date('now', 'start of month') <= date(fecha) 
                AND date(fecha) <= date('now', 'start of month', '+1 month', '-1 day')) as litros_retirados_mes
        FROM clientes c 
        WHERE c.telefono = ? AND c.activo = 1
    ''', (telefono,))
    
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
        # Calcular totales
        litros_gasolina = float(data.get('litros_mes_gasolina', 0))
        litros_gasoil = float(data.get('litros_mes_gasoil', 0))
        total_litros = litros_gasolina + litros_gasoil
        
        cursor.execute('''
            INSERT INTO clientes (
                nombre, direccion, telefono, cedula, rif, placa,
                categoria, subcategoria, exonerado, huella,
                litros_mes, litros_disponibles,
                litros_mes_gasolina, litros_mes_gasoil,
                litros_disponibles_gasolina, litros_disponibles_gasoil
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('nombre'),
            data.get('direccion'),
            data.get('telefono'),
            data.get('cedula'),
            data.get('rif'),
            data.get('placa'),
            data.get('categoria', 'Persona Natural'),
            data.get('subcategoria'),
            data.get('exonerado', False),
            data.get('huella', False),
            total_litros,           # litros_mes (total)
            total_litros,           # litros_disponibles (total inicial)
            litros_gasolina,
            litros_gasoil,
            litros_gasolina,        # litros_disponibles_gasolina (inicial)
            litros_gasoil           # litros_disponibles_gasoil (inicial)
        ))
        
        db.commit()
        return jsonify({'id': cursor.lastrowid}), 201
    except Exception as e:
        db.rollback()
        print(f"Error creando cliente: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/clientes/<int:id>', methods=['PUT'])
@token_required
def actualizar_cliente(id):
    if not g.es_admin:
        return jsonify({'error': 'No autorizado'}), 403
        
    data = request.json
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Calcular totales
        litros_gasolina = float(data.get('litros_mes_gasolina', 0))
        litros_gasoil = float(data.get('litros_mes_gasoil', 0))
        total_litros = litros_gasolina + litros_gasoil
        
        cursor.execute('''
            UPDATE clientes SET
                nombre = ?, direccion = ?, telefono = ?, cedula = ?, rif = ?, placa = ?,
                categoria = ?, subcategoria = ?, exonerado = ?, huella = ?,
                litros_mes = ?, 
                litros_mes_gasolina = ?, litros_mes_gasoil = ?
            WHERE id = ?
        ''', (
            data.get('nombre'),
            data.get('direccion'),
            data.get('telefono'),
            data.get('cedula'),
            data.get('rif'),
            data.get('placa'),
            data.get('categoria'),
            data.get('subcategoria'),
            data.get('exonerado', False),
            data.get('huella', False),
            total_litros,
            litros_gasolina,
            litros_gasoil,
            id
        ))
        
        db.commit()
        return jsonify({'message': 'Cliente actualizado'}), 200
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

# Rutas de estadísticas
@app.route('/api/estadisticas', methods=['GET'])
@token_required
def obtener_estadisticas_generales():
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Total clientes activos
        cursor.execute('SELECT COUNT(*) as total FROM clientes WHERE activo = 1')
        total_clientes = cursor.fetchone()['total']
        
        # Total litros entregados (histórico)
        cursor.execute('SELECT SUM(litros) as total FROM retiros')
        result = cursor.fetchone()
        total_litros = result['total'] if result and result['total'] else 0
        
        return jsonify({
            'totalClientes': total_clientes,
            'totalLitrosEntregados': total_litros,
            'proximosVencimientos': 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/estadisticas/retiros', methods=['GET'])
@token_required
def obtener_estadisticas_retiros():
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Litros hoy
        cursor.execute("SELECT SUM(litros) as total FROM retiros WHERE date(fecha) = date('now')")
        res = cursor.fetchone()
        litros_hoy = res['total'] if res and res['total'] else 0
        
        # Litros mes
        cursor.execute("SELECT SUM(litros) as total FROM retiros WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')")
        res = cursor.fetchone()
        litros_mes = res['total'] if res and res['total'] else 0
        
        # Litros año
        cursor.execute("SELECT SUM(litros) as total FROM retiros WHERE strftime('%Y', fecha) = strftime('%Y', 'now')")
        res = cursor.fetchone()
        litros_ano = res['total'] if res and res['total'] else 0
        
        # Clientes hoy
        cursor.execute("SELECT COUNT(DISTINCT cliente_id) as total FROM retiros WHERE date(fecha) = date('now')")
        clientes_hoy = cursor.fetchone()['total']
        
        # Retiros por día (últimos 7 días)
        cursor.execute('''
            SELECT date(fecha) as dia, SUM(litros) as total 
            FROM retiros 
            WHERE date(fecha) >= date('now', '-7 days')
            GROUP BY date(fecha)
            ORDER BY date(fecha)
        ''')
        retiros_dia = [dict(row) for row in cursor.fetchall()]
        
        # Litros por mes (últimos 12 meses)
        cursor.execute('''
            SELECT strftime('%Y-%m', fecha) as mes, SUM(litros) as total 
            FROM retiros 
            WHERE date(fecha) >= date('now', '-12 months')
            GROUP BY strftime('%Y-%m', fecha)
            ORDER BY strftime('%Y-%m', fecha)
        ''')
        litros_por_mes = [dict(row) for row in cursor.fetchall()]
        
        return jsonify({
            'litrosHoy': litros_hoy,
            'litrosMes': litros_mes,
            'litrosAno': litros_ano,
            'clientesHoy': clientes_hoy,
            'retirosPorDia': retiros_dia,
            'litrosPorMes': litros_por_mes
        })
    except Exception as e:
        print(f"Error stats: {e}")
        return jsonify({'error': str(e)}), 500

# Rutas de agendamientos
@app.route('/api/agendamientos/dia/<fecha>', methods=['GET'])
def obtener_agendamientos_dia(fecha):
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('''
            SELECT 
                a.id,
                a.cliente_id,
                c.nombre as cliente_nombre,
                c.cedula,
                c.telefono,
                c.placa,
                a.tipo_combustible,
                a.litros,
                a.fecha_agendada,
                a.codigo_ticket,
                a.estado,
                a.fecha_creacion,
                a.subcliente_id,
                s.nombre AS subcliente_nombre,
                s.cedula AS subcliente_cedula,
                s.placa AS subcliente_placa
            FROM agendamientos a
            JOIN clientes c ON a.cliente_id = c.id
            LEFT JOIN clientes s ON a.subcliente_id = s.id
            WHERE a.fecha_agendada = ?
            ORDER BY a.codigo_ticket ASC
        ''', (fecha,))
        
        agendamientos = [dict(row) for row in cursor.fetchall()]
        return jsonify(agendamientos)
    except Exception as e:
        print(f"Error al obtener agendamientos: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

# Rutas de sistema y administración
@app.route('/api/sistema/limites', methods=['GET'])
def obtener_limites():
    db = get_db()
    cursor = db.cursor()
    
    try:
        from datetime import datetime, timedelta
        
        # Obtener configuración
        cursor.execute('SELECT limite_diario_gasolina FROM sistema_config WHERE id = 1')
        config = cursor.fetchone()
        limite_diario = config['limite_diario_gasolina'] if config and config['limite_diario_gasolina'] else 2000
        
        # Fechas
        hoy = datetime.now().strftime('%Y-%m-%d')
        mañana = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Límites de hoy
        cursor.execute('''
            SELECT litros_agendados, litros_procesados 
            FROM limites_diarios 
            WHERE fecha = ? AND tipo_combustible = "gasolina"
        ''', (hoy,))
        limites_hoy = cursor.fetchone()
        
        # Límites de mañana
        cursor.execute('''
            SELECT litros_agendados 
            FROM limites_diarios 
            WHERE fecha = ? AND tipo_combustible = "gasolina"
        ''', (mañana,))
        limites_mañana = cursor.fetchone()
        
        return jsonify({
            'limite_diario': limite_diario,
            'hoy': {
                'fecha': hoy,
                'agendados': limites_hoy['litros_agendados'] if limites_hoy else 0,
                'procesados': limites_hoy['litros_procesados'] if limites_hoy else 0
            },
            'mañana': {
                'fecha': mañana,
                'agendados': limites_mañana['litros_agendados'] if limites_mañana else 0,
                'disponible': limite_diario - (limites_mañana['litros_agendados'] if limites_mañana else 0)
            }
        })
    except Exception as e:
        print(f"Error al obtener límites: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/sistema/bloqueo', methods=['GET', 'POST'])
@token_required
def sistema_bloqueo():
    db = get_db()
    cursor = db.cursor()
    
    if request.method == 'GET':
        cursor.execute('SELECT retiros_bloqueados FROM sistema_config WHERE id = 1')
        res = cursor.fetchone()
        return jsonify({'bloqueado': bool(res['retiros_bloqueados']) if res else False})
        
    if request.method == 'POST':
        if not g.es_admin:
            return jsonify({'error': 'No autorizado'}), 403
            
        bloqueado = request.json.get('bloqueado', False)
        cursor.execute('UPDATE sistema_config SET retiros_bloqueados = ? WHERE id = 1', (1 if bloqueado else 0,))
        db.commit()
        
        estado = "bloqueados" if bloqueado else "desbloqueados"
        return jsonify({'message': f'Retiros {estado} exitosamente'})

@app.route('/api/admin/reset-litros', methods=['POST'])
@token_required
def reset_litros():
    if not g.es_admin:
        return jsonify({'error': 'No autorizado'}), 403
        
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Resetear litros disponibles a su valor mensual
        cursor.execute('''
            UPDATE clientes 
            SET litros_disponibles = litros_mes,
                litros_disponibles_gasolina = litros_mes_gasolina,
                litros_disponibles_gasoil = litros_mes_gasoil
            WHERE activo = 1
        ''')
        
        changes = cursor.rowcount
        db.commit()
        return jsonify({'message': 'Litros reseteados exitosamente', 'clientes_actualizados': changes})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

# Rutas de inventario
@app.route('/api/inventario/estado', methods=['GET'])
def obtener_estado_inventario():
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('SELECT tipo_combustible, litros_disponibles FROM inventario ORDER BY id DESC')
        inventarios = cursor.fetchall()
        
        # Obtener el último registro de cada tipo de combustible
        estado_inventario = {}
        tipos_vistos = set()
        for inv in inventarios:
            tipo = inv['tipo_combustible']
            if tipo not in tipos_vistos:
                estado_inventario[tipo] = inv['litros_disponibles']
                tipos_vistos.add(tipo)
        
        disponible = any(litros > 0 for litros in estado_inventario.values())
        
        return jsonify({
            'inventario': estado_inventario,
            'disponible': disponible
        })
    except Exception as e:
        print(f"Error al obtener estado del inventario: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/inventario', methods=['GET'])
@token_required
def obtener_inventario():
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Obtener el último registro de cada tipo de combustible
        cursor.execute('SELECT * FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1', ('gasoil',))
        gasoil = cursor.fetchone()
        
        cursor.execute('SELECT * FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1', ('gasolina',))
        gasolina = cursor.fetchone()
        
        # Devolver un array con ambos tipos
        inventario = []
        if gasoil:
            inventario.append(dict(gasoil))
        if gasolina:
            inventario.append(dict(gasolina))
        
        return jsonify(inventario)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario/historial', methods=['GET'])
@token_required
def obtener_historial_inventario():
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('''
            SELECT i.*, u.usuario as usuario_nombre 
            FROM inventario i 
            LEFT JOIN usuarios u ON i.usuario_id = u.id 
            ORDER BY i.fecha_ingreso DESC
        ''')
        historial = [dict(row) for row in cursor.fetchall()]
        return jsonify(historial)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario', methods=['POST'])
@token_required
def crear_inventario():
    if not g.es_admin:
        return jsonify({'error': 'No autorizado'}), 403
        
    db = get_db()
    cursor = db.cursor()
    
    try:
        data = request.json
        tipo_combustible = str(data.get('tipo_combustible', '')).lower().strip()
        litros_ingresados = float(data.get('litros_ingresados', 0))
        observaciones = data.get('observaciones', '')
        
        if tipo_combustible not in ['gasoil', 'gasolina']:
            return jsonify({'error': 'Tipo de combustible inválido. Use "gasoil" o "gasolina"'}), 400
        
        if litros_ingresados <= 0:
            return jsonify({'error': 'Ingrese una cantidad válida de litros'}), 400
        
        # Obtener el inventario actual para el tipo de combustible específico
        cursor.execute('SELECT * FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1', (tipo_combustible,))
        inventario_actual = cursor.fetchone()
        
        litros_disponibles = (dict(inventario_actual)['litros_disponibles'] if inventario_actual else 0) + litros_ingresados
        
        # Insertar nuevo registro de inventario
        cursor.execute('''
            INSERT INTO inventario (tipo_combustible, litros_ingresados, litros_disponibles, usuario_id, observaciones)
            VALUES (?, ?, ?, ?, ?)
        ''', (tipo_combustible, litros_ingresados, litros_disponibles, g.usuario_id, observaciones))
        
        db.commit()
        return jsonify({
            'id': cursor.lastrowid,
            'litros_ingresados': litros_ingresados,
            'litros_disponibles': litros_disponibles,
            'usuario_id': g.usuario_id,
            'observaciones': observaciones
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventario/reset', methods=['POST'])
@token_required
def resetear_inventario():
    if not g.es_admin:
        return jsonify({'error': 'No autorizado'}), 403
        
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Obtener el último registro de gasoil
        cursor.execute('SELECT id FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1', ('gasoil',))
        gasoil_record = cursor.fetchone()
        if gasoil_record:
            cursor.execute('UPDATE inventario SET litros_disponibles = 0 WHERE id = ?', (dict(gasoil_record)['id'],))
        
        # Obtener el último registro de gasolina
        cursor.execute('SELECT id FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1', ('gasolina',))
        gasolina_record = cursor.fetchone()
        if gasolina_record:
            cursor.execute('UPDATE inventario SET litros_disponibles = 0 WHERE id = ?', (dict(gasolina_record)['id'],))
        
        db.commit()
        return jsonify({
            'message': 'Inventario reseteado a 0 litros',
            'gasoil': 0,
            'gasolina': 0
        })
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500

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
