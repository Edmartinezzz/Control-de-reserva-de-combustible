from flask import Flask, jsonify, request, g, make_response
from flask_cors import CORS, cross_origin
import psycopg2
import psycopg2.extras
import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
import urllib.parse

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu_clave_secreta_muy_segura')  # En producción, usa una variable de entorno

# Configurar JSON Encoder personalizado para manejar fechas y decimales
from flask.json.provider import DefaultJSONProvider
import decimal
from datetime import date, time

class CustomJSONProvider(DefaultJSONProvider):
    def default(self, obj):
        if isinstance(obj, date):
            return obj.isoformat()
        if isinstance(obj, time):
            return obj.isoformat()
        if isinstance(obj, decimal.Decimal):
            return float(obj)
        return super().default(obj)

app.json = CustomJSONProvider(app)

# Ruta raíz para health check
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'status': 'online',
        'message': 'API de Despacho Gas+ funcionando correctamente',
        'version': '2.0.0 (PostgreSQL)',
        'database': 'PostgreSQL'
    })

# Obtener origen permitido desde variable de entorno (para producción)
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3001').split(',')

# Configuración CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
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
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

# Configuración de la base de datos PostgreSQL
def get_db():
    if 'db' not in g:
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            raise Exception("DATABASE_URL no está configurada")
        
        # Parse the URL
        result = urllib.parse.urlparse(database_url)
        g.db = psycopg2.connect(
            database=result.path[1:],
            user=result.username,
            password=result.password,
            host=result.hostname,
            port=result.port,
            cursor_factory=psycopg2.extras.RealDictCursor
        )
        g.db.set_session(autocommit=False)
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def verificar_reset_diario():
    """
    Verifica si es necesario resetear los litros disponibles de los clientes.
    
    IMPORTANTE: Esta función debe ejecutarse SOLO:
    - En el login del cliente (para verificar si pasó un nuevo día)
    - A las 4:00 AM Venezuela time (mediante cron job o scheduler)
    
    NO debe ejecutarse en cada consulta de datos del cliente.
    """
    try:
        # Hora actual en Venezuela (UTC-4)
        utc_now = datetime.utcnow()
        venezuela_now = utc_now - timedelta(hours=4)
        hoy_venezuela = venezuela_now.date()
        
        db = get_db()
        cursor = db.cursor()
        
        # Obtener fecha último reset
        cursor.execute('SELECT fecha_ultimo_reset FROM sistema_config WHERE id = 1')
        row = cursor.fetchone()
        
        if not row:
            print("⚠️ No se encontró configuración del sistema")
            return
        
        ultimo_reset = row['fecha_ultimo_reset']
        
        # Si fecha_ultimo_reset es NULL, inicializarla a hoy para evitar reset inmediato
        if ultimo_reset is None:
            print(f"⚠️ fecha_ultimo_reset era NULL, inicializando a hoy: {hoy_venezuela}")
            cursor.execute('UPDATE sistema_config SET fecha_ultimo_reset = %s WHERE id = 1', (hoy_venezuela,))
            db.commit()
            print("✅ fecha_ultimo_reset inicializada correctamente")
            print("   ℹ️  No se ejecutará reset ahora, se esperará hasta mañana a las 4:00 AM")
            return
        
        # Convertir ultimo_reset a date si es datetime
        if hasattr(ultimo_reset, 'date'):
            ultimo_reset = ultimo_reset.date()
        
        # Si ya se reseteó hoy, no hacer nada
        if ultimo_reset >= hoy_venezuela:
            print(f"✅ Reset ya ejecutado hoy ({ultimo_reset}), no se requiere acción")
            return
        
        # Solo resetear si es después de las 4:00 AM Y no se ha reseteado hoy
        if venezuela_now.hour >= 4:
            print("=" * 70)
            print(f"🔄 EJECUTANDO RESET DIARIO AUTOMÁTICO")
            print(f"   Fecha: {hoy_venezuela}")
            print(f"   Hora Venezuela: {venezuela_now.hour:02d}:{venezuela_now.minute:02d}")
            print(f"   Último reset: {ultimo_reset}")
            print("=" * 70)
            
            # Ejecutar reset
            cursor.execute('''
                UPDATE clientes 
                SET litros_disponibles = litros_mes,
                    litros_disponibles_gasolina = litros_mes_gasolina,
                    litros_disponibles_gasoil = litros_mes_gasoil
                WHERE activo = TRUE
            ''')
            
            clientes_actualizados = cursor.rowcount
            
            # Actualizar fecha último reset
            cursor.execute('UPDATE sistema_config SET fecha_ultimo_reset = %s WHERE id = 1', (hoy_venezuela,))
            
            db.commit()
            
            print(f"✅ RESET DIARIO COMPLETADO EXITOSAMENTE")
            print(f"   Clientes actualizados: {clientes_actualizados}")
            print(f"   Nueva fecha_ultimo_reset: {hoy_venezuela}")
            print("=" * 70)
        else:
            print(f"⏰ Es antes de las 4:00 AM ({venezuela_now.hour:02d}:{venezuela_now.minute:02d})")
            print(f"   Esperando hasta las 4:00 AM para ejecutar reset")
            print(f"   Último reset: {ultimo_reset}")
        
    except Exception as e:
        print(f"❌ ERROR en reset diario: {e}")
        import traceback
        traceback.print_exc()
        try:
            db = get_db()
            db.rollback()
        except:
            pass

# Inicializar la base de datos
def init_db():
    with app.app_context():
        db = get_db()
        cursor = db.cursor()
        
        
        # Crear tablas si no existen (PostgreSQL syntax)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                usuario VARCHAR(255) UNIQUE NOT NULL,
                contrasena VARCHAR(255) NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                es_admin BOOLEAN DEFAULT FALSE
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS clientes (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255) NOT NULL,
                direccion TEXT,
                telefono VARCHAR(50),
                cedula VARCHAR(50) UNIQUE,
                rif VARCHAR(50),
                placa VARCHAR(50),
                categoria VARCHAR(100) DEFAULT 'Persona Natural',
                subcategoria VARCHAR(100),
                exonerado BOOLEAN DEFAULT FALSE,
                huella BOOLEAN DEFAULT FALSE,
                litros_mes REAL DEFAULT 0,
                litros_disponibles REAL DEFAULT 0,
                litros_mes_gasolina REAL DEFAULT 0,
                litros_mes_gasoil REAL DEFAULT 0,
                litros_disponibles_gasolina REAL DEFAULT 0,
                litros_disponibles_gasoil REAL DEFAULT 0,
                activo BOOLEAN DEFAULT TRUE
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS retiros (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER NOT NULL,
                fecha DATE NOT NULL,
                hora TIME NOT NULL DEFAULT '00:00:00',
                litros REAL NOT NULL,
                usuario_id INTEGER NOT NULL,
                tipo_combustible VARCHAR(20) DEFAULT 'gasoil',
                codigo_ticket INTEGER,
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
            CREATE TABLE IF NOT EXISTS subclientes (
                id SERIAL PRIMARY KEY,
                cliente_padre_id INTEGER NOT NULL,
                nombre VARCHAR(255) NOT NULL,
                cedula VARCHAR(50),
                placa VARCHAR(50),
                litros_mes_gasolina REAL DEFAULT 0,
                litros_mes_gasoil REAL DEFAULT 0,
                litros_disponibles_gasolina REAL DEFAULT 0,
                litros_disponibles_gasoil REAL DEFAULT 0,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_padre_id) REFERENCES clientes (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS agendamientos (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER NOT NULL,
                subcliente_id INTEGER,
                tipo_combustible VARCHAR(20) NOT NULL DEFAULT 'gasolina',
                litros REAL NOT NULL,
                fecha_agendada DATE NOT NULL,
                codigo_ticket INTEGER,
                estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cliente_id) REFERENCES clientes (id),
                FOREIGN KEY (subcliente_id) REFERENCES subclientes (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS limites_diarios (
                id SERIAL PRIMARY KEY,
                fecha DATE NOT NULL,
                tipo_combustible VARCHAR(20) NOT NULL DEFAULT 'gasolina',
                litros_agendados REAL DEFAULT 0,
                litros_procesados REAL DEFAULT 0,
                UNIQUE(fecha, tipo_combustible)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS inventario (
                id SERIAL PRIMARY KEY,
                tipo_combustible VARCHAR(20) NOT NULL CHECK(tipo_combustible IN ('gasoil', 'gasolina')),
                litros_ingresados REAL NOT NULL,
                litros_disponibles REAL NOT NULL,
                fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                usuario_id INTEGER,
                observaciones TEXT,
                FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
            )
        ''')

        # Agregar columna fecha_ultimo_reset si no existe
        try:
            cursor.execute('ALTER TABLE sistema_config ADD COLUMN fecha_ultimo_reset DATE')
            db.commit()
        except Exception:
            db.rollback()
            
        # Inicializar fecha_ultimo_reset si es NULL
        cursor.execute('UPDATE sistema_config SET fecha_ultimo_reset = CURRENT_DATE - INTERVAL \'1 day\' WHERE fecha_ultimo_reset IS NULL')
        db.commit()

        # Verificar si existe usuario admin
        cursor.execute('SELECT * FROM usuarios WHERE usuario = %s', ('admin',))
        if not cursor.fetchone():
            # Crear usuario admin por defecto
            hashed_password = 'admin_password_placeholder' # Debería ser hasheado
            # Aquí deberíamos usar bcrypt pero para simplificar en init_db asumimos que se crea luego o manualmente
            # Mejor no crear admin hardcodeado si no tenemos hash function aquí disponible fácilmente sin importar
            pass
            
        db.commit()
        print("✅ Base de datos PostgreSQL inicializada correctamente")

        
        
        # Inicializar configuración si no existe
        cursor.execute('SELECT * FROM sistema_config WHERE id = 1')
        if not cursor.fetchone():
            cursor.execute('INSERT INTO sistema_config (id, retiros_bloqueados) VALUES (1, 0)')
        
        # Crear o actualizar usuario admin
        admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
        
        cursor.execute('SELECT * FROM usuarios WHERE usuario = %s', ('admin',))
        if cursor.fetchone():
            # Si existe, actualizar contraseña
            cursor.execute(
                'UPDATE usuarios SET contrasena = %s WHERE usuario = %s',
                (admin_password, 'admin')
            )
            print(f"Usuario admin actualizado con contraseña configurada")
        else:
            # Si no existe, crear
            cursor.execute(
                'INSERT INTO usuarios (usuario, contrasena, nombre, es_admin) VALUES (%s, %s, %s, %s)',
                ('admin', admin_password, 'Administrador', True)
            )
            print(f"Usuario admin creado con contraseña configurada")
        
        db.commit()
        print("✅ Base de datos PostgreSQL inicializada correctamente")

# Decorador para verificar el token JWT
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token no proporcionado'}), 403
        try:
            data = jwt.decode(token.split()[1], app.config['SECRET_KEY'], algorithms=['HS256'])
            
            # Verificar si es token de admin o cliente
            if 'es_admin' in data:
                # Token de administrador
                g.usuario_actual = data['usuario']
                g.usuario_id = data['id']
                g.es_admin = data['es_admin']
                g.es_cliente = False
                g.cliente_id = None
            elif 'tipo' in data and data['tipo'] == 'cliente':
                # Token de cliente
                g.usuario_actual = data.get('nombre', data.get('cedula'))
                g.usuario_id = None
                g.es_admin = False
                g.es_cliente = True
                g.cliente_id = data['id']
            else:
                return jsonify({'message': 'Token inválido'}), 403
                
        except Exception as e:
            print(f"Error al decodificar token: {e}")
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
        
        cursor.execute('SELECT * FROM usuarios WHERE usuario = %s', (data.get('usuario'),))
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
    verificar_reset_diario()
    try:
        data = request.json
        cedula = data.get('cedula')
        
        if not cedula:
            return jsonify({'error': 'La cédula es requerida'}), 400
        
        db = get_db()
        cursor = db.cursor()
        
        cursor.execute('SELECT * FROM clientes WHERE cedula = %s AND activo = TRUE', (cedula,))
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
    query = 'SELECT * FROM clientes WHERE activo = TRUE'
    params = []
    
    if busqueda:
        query += ' AND (nombre LIKE %s OR direccion LIKE %s)'
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
            WHERE activo = TRUE 
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
            WHERE c.activo = TRUE 
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
    # ❌ REMOVED: verificar_reset_diario() - This was causing resets on every data fetch!
    # The reset should ONLY happen at 4:00 AM, not every time the dashboard loads
    # Reset is still triggered on login (see login_cliente endpoint)
    
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('''
        SELECT c.*, 
               (SELECT SUM(litros) FROM retiros 
                WHERE cliente_id = c.id 
                AND fecha >= DATE_TRUNC('month', CURRENT_DATE) 
                AND fecha < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') as litros_retirados_mes
        FROM clientes c 
        WHERE c.id = %s AND c.activo = TRUE
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
            WHERE r.cliente_id = %s
            ORDER BY r.fecha DESC
            LIMIT 50
        ''', (cliente_id,))
        
        tickets = [dict(row) for row in cursor.fetchall()]
        return jsonify(tickets)
    except Exception as e:
        print(f"Error al obtener tickets del cliente: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/clientes/<int:cliente_id>/subclientes', methods=['GET'])
@token_required
def obtener_subclientes(cliente_id):
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Si es cliente, solo puede ver sus propios subclientes
        if g.es_cliente and g.cliente_id != cliente_id:
            return jsonify({'error': 'No autorizado'}), 403
        
        # Verificar que el cliente padre existe
        cursor.execute('SELECT id, nombre FROM clientes WHERE id = %s AND activo = TRUE', (cliente_id,))
        cliente_padre = cursor.fetchone()
        if not cliente_padre:
            return jsonify({'error': 'Cliente padre no encontrado'}), 404
        
        cursor.execute('''
            SELECT id, cliente_padre_id, nombre, cedula, placa,
                   litros_mes_gasolina, litros_mes_gasoil,
                   litros_disponibles_gasolina, litros_disponibles_gasoil,
                   activo, created_at, updated_at
            FROM subclientes
            WHERE cliente_padre_id = %s AND activo = TRUE
            ORDER BY nombre ASC
        ''', (cliente_id,))
        
        subclientes = [dict(row) for row in cursor.fetchall()]
        return jsonify(subclientes)
    except Exception as e:
        print(f"Error al obtener subclientes: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/clientes/<int:cliente_id>/subclientes', methods=['POST'])
@token_required
def crear_subcliente(cliente_id):
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Si es cliente, solo puede crear subclientes para sí mismo
        if g.es_cliente and g.cliente_id != cliente_id:
            return jsonify({'error': 'No autorizado'}), 403
        
        data = request.json
        nombre = data.get('nombre')
        cedula = data.get('cedula')
        placa = data.get('placa')
        litros_mes_gasolina = float(data.get('litros_mes_gasolina', 0))
        litros_mes_gasoil = float(data.get('litros_mes_gasoil', 0))
        
        if not nombre:
            return jsonify({'error': 'El nombre del subcliente es requerido'}), 400
        
        # Verificar cliente padre
        cursor.execute('SELECT id, nombre, litros_mes_gasolina, litros_mes_gasoil FROM clientes WHERE id = %s AND activo = TRUE', (cliente_id,))
        cliente_padre = cursor.fetchone()
        if not cliente_padre:
            return jsonify({'error': 'Cliente padre no encontrado'}), 404
        
        cliente_padre_dict = dict(cliente_padre)
        
        # Obtener suma actual de litros asignados a subclientes
        cursor.execute('''
            SELECT 
                COALESCE(SUM(litros_mes_gasolina), 0) AS total_gasolina,
                COALESCE(SUM(litros_mes_gasoil), 0) AS total_gasoil
            FROM subclientes
            WHERE cliente_padre_id = %s AND activo = TRUE
        ''', (cliente_id,))
        sumas = cursor.fetchone()
        
        total_gasolina_asignado = (sumas['total_gasolina'] if sumas else 0) + litros_mes_gasolina
        total_gasoil_asignado = (sumas['total_gasoil'] if sumas else 0) + litros_mes_gasoil
        
        # Validar que no exceda los litros mensuales del cliente padre
        padre_gasolina_mes = cliente_padre_dict.get('litros_mes_gasolina', 0) or 0
        padre_gasoil_mes = cliente_padre_dict.get('litros_mes_gasoil', 0) or 0
        
        if total_gasolina_asignado > padre_gasolina_mes or total_gasoil_asignado > padre_gasoil_mes:
            return jsonify({
                'error': 'Los litros asignados a subclientes exceden los litros mensuales del cliente padre',
                'padre_gasolina': padre_gasolina_mes,
                'padre_gasoil': padre_gasoil_mes,
                'asignado_gasolina': total_gasolina_asignado,
                'asignado_gasoil': total_gasoil_asignado
            }), 400
        
        # Crear subcliente
        cursor.execute('''
            INSERT INTO subclientes (
                cliente_padre_id, nombre, cedula, placa,
                litros_mes_gasolina, litros_mes_gasoil,
                litros_disponibles_gasolina, litros_disponibles_gasoil,
                activo
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, TRUE)
        ''', (
            cliente_id,
            nombre,
            cedula,
            placa,
            litros_mes_gasolina,
            litros_mes_gasoil,
            litros_mes_gasolina,  # litros_disponibles inicial = litros_mes
            litros_mes_gasoil     # litros_disponibles inicial = litros_mes
        ))
        
        db.commit()
        subcliente_id = cursor.lastrowid
        
        return jsonify({
            'message': 'Subcliente creado exitosamente',
            'subclienteId': subcliente_id
        }), 201
    except Exception as e:
        db.rollback()
        print(f"Error al crear subcliente: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/clientes/telefono/<telefono>', methods=['GET'])
def obtener_cliente_por_telefono(telefono):
    db = get_db()
    cursor = db.cursor()
    
    cursor.execute('''
        SELECT c.*, 
               (SELECT SUM(litros) FROM retiros 
                WHERE cliente_id = c.id 
                AND fecha >= DATE_TRUNC('month', CURRENT_DATE) 
                AND fecha < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') as litros_retirados_mes
        FROM clientes c 
        WHERE c.telefono = %s AND c.activo = TRUE
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
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                nombre = %s, direccion = %s, telefono = %s, cedula = %s, rif = %s, placa = %s,
                categoria = %s, subcategoria = %s, exonerado = %s, huella = %s,
                litros_mes = %s, 
                litros_mes_gasolina = %s, litros_mes_gasoil = %s
            WHERE id = %s
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
        cliente_id = data.get('cliente_id')
        litros = float(data.get('litros', 0))
        tipo_combustible = data.get('tipo_combustible', 'gasolina')
        
        if litros <= 0:
            return jsonify({'error': 'La cantidad debe ser mayor a cero'}), 400

        # Verificar si el cliente existe y tiene saldo suficiente
        cursor.execute('SELECT * FROM clientes WHERE id = %s AND activo = TRUE', (cliente_id,))
        cliente = cursor.fetchone()
        
        if not cliente:
            return jsonify({'error': 'Cliente no encontrado'}), 404
            
        # Verificar saldo disponible del cliente
        campo_disponible = f'litros_disponibles_{tipo_combustible}'
        saldo_actual = cliente.get(campo_disponible, 0)
        
        # if saldo_actual < litros:
        #     return jsonify({'error': f'Saldo insuficiente de {tipo_combustible}. Disponible: {saldo_actual}'}), 400
        
        # Verificar inventario disponible
        cursor.execute('SELECT id, litros_disponibles FROM inventario WHERE tipo_combustible = %s ORDER BY id DESC LIMIT 1', (tipo_combustible,))
        inventario = cursor.fetchone()
        
        if not inventario: # or inventario['litros_disponibles'] < litros:
             # Permitir retiro aunque no haya inventario registrado por ahora, o descomentar para restringir
             pass
        
        # Registrar el retiro
        cursor.execute('''
            INSERT INTO retiros (cliente_id, fecha, hora, litros, usuario_id, tipo_combustible)
            VALUES (%s, CURRENT_DATE, CURRENT_TIME, %s, %s, %s)
        ''', (cliente_id, litros, g.usuario_id, tipo_combustible))
        
        # Actualizar el saldo del cliente
        # Actualizar el saldo del cliente
        print(f"DEBUG: Actualizando cliente {cliente_id}, descontando {litros} de {campo_disponible}")
        cursor.execute(f'''
            UPDATE clientes 
            SET litros_disponibles = COALESCE(litros_disponibles, 0) - %s,
                {campo_disponible} = COALESCE({campo_disponible}, 0) - %s
            WHERE id = %s
        ''', (litros, litros, cliente_id))
        print(f"DEBUG: Filas actualizadas en clientes: {cursor.rowcount}")
        
        # Actualizar inventario (restar del último registro)
        if inventario:
            cursor.execute('''
                UPDATE inventario 
                SET litros_disponibles = litros_disponibles - %s 
                WHERE id = %s
            ''', (litros, inventario['id']))
        
        db.commit()
        return jsonify({'mensaje': 'Retiro registrado exitosamente'}), 201
    except Exception as e:
        db.rollback()
        print(f"Error en retiro: {e}")
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
        query += ' AND r.cliente_id = %s'
        params.append(cliente_id)
        
    if fecha_inicio:
        query += ' AND r.fecha >= %s'
        params.append(fecha_inicio)
        
    if fecha_fin:
        query += ' AND r.fecha <= %s'
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
        cursor.execute('SELECT COUNT(*) as total FROM clientes WHERE activo = TRUE')
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
        # Litros hoy (Suma de retiros directos + agendamientos ENTREGADOS)
        cursor.execute('''
            SELECT 
                (SELECT COALESCE(SUM(litros), 0) FROM retiros WHERE DATE(fecha) = CURRENT_DATE) +
                (SELECT COALESCE(SUM(litros), 0) FROM agendamientos WHERE fecha_agendada = CURRENT_DATE AND estado = 'entregado') 
            as total
        ''')
        res = cursor.fetchone()
        litros_hoy = res['total'] if res and res['total'] else 0
        
        # Litros mes
        cursor.execute('''
            SELECT 
                (SELECT COALESCE(SUM(litros), 0) FROM retiros WHERE TO_CHAR(fecha, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')) +
                (SELECT COALESCE(SUM(litros), 0) FROM agendamientos WHERE TO_CHAR(fecha_agendada, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM') AND estado = 'entregado')
            as total
        ''')
        res = cursor.fetchone()
        litros_mes = res['total'] if res and res['total'] else 0
        
        # Litros año
        cursor.execute('''
            SELECT 
                (SELECT COALESCE(SUM(litros), 0) FROM retiros WHERE TO_CHAR(fecha, 'YYYY') = TO_CHAR(CURRENT_DATE, 'YYYY')) +
                (SELECT COALESCE(SUM(litros), 0) FROM agendamientos WHERE TO_CHAR(fecha_agendada, 'YYYY') = TO_CHAR(CURRENT_DATE, 'YYYY') AND estado = 'entregado')
            as total
        ''')
        res = cursor.fetchone()
        litros_ano = res['total'] if res and res['total'] else 0
        
        # Clientes hoy (Union de ambos)
        cursor.execute('''
            SELECT COUNT(DISTINCT cliente_id) as total FROM (
                SELECT cliente_id FROM retiros WHERE DATE(fecha) = CURRENT_DATE
                UNION
                SELECT cliente_id FROM agendamientos WHERE fecha_agendada = CURRENT_DATE AND estado = 'entregado'
            ) as combined
        ''')
        clientes_hoy = cursor.fetchone()['total']
        
        # Retiros por día (últimos 7 días) - Combinado
        cursor.execute('''
            SELECT date_val as dia, SUM(total) as total
            FROM (
                SELECT DATE(fecha) as date_val, litros as total FROM retiros WHERE DATE(fecha) >= CURRENT_DATE - INTERVAL '7 days'
                UNION ALL
                SELECT fecha_agendada as date_val, litros as total FROM agendamientos WHERE fecha_agendada >= CURRENT_DATE - INTERVAL '7 days' AND estado = 'entregado'
            ) as combined
            GROUP BY date_val
            ORDER BY date_val
        ''')
        retiros_dia = [dict(row) for row in cursor.fetchall()]
        
        # Litros por mes (últimos 12 meses) - Combinado
        cursor.execute('''
            SELECT month_val as mes, SUM(total) as total
            FROM (
                SELECT TO_CHAR(fecha, 'YYYY-MM') as month_val, litros as total FROM retiros WHERE DATE(fecha) >= CURRENT_DATE - INTERVAL '12 months'
                UNION ALL
                SELECT TO_CHAR(fecha_agendada, 'YYYY-MM') as month_val, litros as total FROM agendamientos WHERE fecha_agendada >= CURRENT_DATE - INTERVAL '12 months' AND estado = 'entregado'
            ) as combined
            GROUP BY month_val
            ORDER BY month_val
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
            WHERE a.fecha_agendada = %s
            ORDER BY a.codigo_ticket ASC
        ''', (fecha,))
        
        agendamientos = [dict(row) for row in cursor.fetchall()]
        return jsonify(agendamientos)
    except Exception as e:
        print(f"Error al obtener agendamientos: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/agendamientos', methods=['POST'])
@token_required
def crear_agendamiento():
    db = get_db()
    cursor = db.cursor()
    
    try:
        data = request.json
        cliente_id = data.get('cliente_id')
        tipo_combustible = data.get('tipo_combustible', 'gasolina')
        litros = float(data.get('litros', 0))
        subcliente_id = data.get('subcliente_id')
        fecha_agendada = data.get('fecha_agendada')
        
        # Si no se proporciona fecha_agendada, usar mañana por defecto
        if not fecha_agendada:
            from datetime import datetime, timedelta
            mañana = datetime.now() + timedelta(days=1)
            fecha_agendada = mañana.strftime('%Y-%m-%d')
        
        if not cliente_id or not litros:
            return jsonify({'error': 'Faltan datos requeridos'}), 400
            
        # 0. Verificar si los agendamientos están BLOQUEADOS
        cursor.execute('SELECT retiros_bloqueados FROM sistema_config WHERE id = 1')
        config_row = cursor.fetchone()
        retiros_bloqueados = config_row['retiros_bloqueados'] if config_row else 0
        
        if retiros_bloqueados:
            return jsonify({
                'error': 'El servicio de agendamientos no está disponible temporalmente. Por favor intente más tarde.',
                'bloqueado': True
            }), 403
            
        # 1. Verificar INVENTARIO GLOBAL disponible
        cursor.execute('''
            SELECT litros_disponibles 
            FROM inventario 
            WHERE tipo_combustible = %s 
            ORDER BY id DESC 
            LIMIT 1
        ''', (tipo_combustible,))
        
        inventario_row = cursor.fetchone()
        inventario_disponible = inventario_row['litros_disponibles'] if inventario_row else 0
        
        # Validar que hay inventario suficiente
        if inventario_disponible < litros:
            return jsonify({
                'error': f'Inventario insuficiente de {tipo_combustible}. Disponible: {inventario_disponible}L, Solicitado: {litros}L',
                'inventario_disponible': inventario_disponible,
                'tipo_combustible': tipo_combustible
            }), 400
        
        # 2. Verificar saldo disponible del cliente
        cursor.execute('SELECT * FROM clientes WHERE id = %s AND activo = TRUE', (cliente_id,))
        cliente = cursor.fetchone()
        
        if not cliente:
            return jsonify({'error': 'Cliente no encontrado'}), 404
            
        campo_disponible = f'litros_disponibles_{tipo_combustible}'
        saldo_actual = cliente.get(campo_disponible, 0)
        
        # Validar saldo suficiente del cliente
        if saldo_actual < litros:
             return jsonify({
                 'error': f'Saldo insuficiente. Disponible: {saldo_actual}L, Solicitado: {litros}L'
             }), 400
        
        # 3. Generar código de ticket (número secuencial para la fecha agendada)
        cursor.execute('''
            SELECT COALESCE(MAX(codigo_ticket), 0) + 1 as next_ticket
            FROM agendamientos
            WHERE fecha_agendada = %s
        ''', (fecha_agendada,))
        
        codigo_ticket = cursor.fetchone()['next_ticket']
        
        # 4. Insertar agendamiento con código de ticket
        cursor.execute('''
            INSERT INTO agendamientos (
                cliente_id, tipo_combustible, litros, fecha_agendada, 
                subcliente_id, estado, codigo_ticket
            ) VALUES (%s, %s, %s, %s, %s, 'pendiente', %s)
        ''', (cliente_id, tipo_combustible, litros, fecha_agendada, subcliente_id, codigo_ticket))
        
        # 5. ACTUALIZAR SALDO DEL CLIENTE (Restar litros)
        print(f"DEBUG: Descontando {litros}L de {tipo_combustible} al cliente {cliente_id}")
        cursor.execute(f'''
            UPDATE clientes 
            SET litros_disponibles = COALESCE(litros_disponibles, 0) - %s,
                {campo_disponible} = COALESCE({campo_disponible}, 0) - %s
            WHERE id = %s
        ''', (litros, litros, cliente_id))
        
        # 6. Si hay subcliente, también actualizar su saldo
        if subcliente_id:
            cursor.execute(f'''
                UPDATE subclientes 
                SET {campo_disponible} = COALESCE({campo_disponible}, 0) - %s
                WHERE id = %s
            ''', (litros, subcliente_id))
        
        # 7. ACTUALIZAR INVENTARIO GLOBAL - RESTAR LITROS
        # Calcular nuevo inventario disponible
        nuevo_inventario = inventario_disponible - litros
        
        # Insertar nuevo registro en el historial de inventario (como salida/retiro)
        print(f"DEBUG: Descontando {litros}L de inventario de {tipo_combustible}. Antes: {inventario_disponible}L, Después: {nuevo_inventario}L")
        cursor.execute('''
            INSERT INTO inventario (
                tipo_combustible, litros_ingresados, litros_disponibles, 
                usuario_id, observaciones
            ) VALUES (%s, %s, %s, %s, %s)
        ''', (
            tipo_combustible, 
            -litros,  # Negativo porque es una salida
            nuevo_inventario,
            g.usuario_id if hasattr(g, 'usuario_id') else None,
            f'Agendamiento #{codigo_ticket} - Cliente ID: {cliente_id}'
        ))
        
        db.commit()
        
        return jsonify({
            'message': 'Agendamiento creado exitosamente',
            'id': cursor.lastrowid,
            'codigo_ticket': codigo_ticket,
            'fecha_agendada': fecha_agendada,
            'nuevo_saldo_cliente': saldo_actual - litros,
            'nuevo_inventario': nuevo_inventario
        }), 201
    except Exception as e:
        db.rollback()
        print(f"Error al crear agendamiento: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500


@app.route('/api/agendamientos/<int:agendamiento_id>/entregar', methods=['PATCH'])
@token_required
def marcar_como_entregado(agendamiento_id):
    db = get_db()
    cursor = db.cursor()
    
    try:
        # Verificar que el agendamiento existe
        cursor.execute('SELECT id, estado FROM agendamientos WHERE id = %s', (agendamiento_id,))
        agendamiento = cursor.fetchone()
        
        if not agendamiento:
            return jsonify({'error': 'Agendamiento no encontrado'}), 404
        
        # Actualizar estado a 'entregado'
        cursor.execute('''
            UPDATE agendamientos 
            SET estado = 'entregado'
            WHERE id = %s
        ''', (agendamiento_id,))
        
        db.commit()
        return jsonify({
            'message': 'Agendamiento marcado como entregado',
            'id': agendamiento_id
        }), 200
    except Exception as e:
        db.rollback()
        print(f"Error al marcar como entregado: {e}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/agendamientos/cliente/<int:cliente_id>', methods=['GET'])
def obtener_agendamientos_cliente(cliente_id):
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute('''
            SELECT 
                a.id,
                a.cliente_id,
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
            LEFT JOIN subclientes s ON a.subcliente_id = s.id
            WHERE a.cliente_id = %s
            ORDER BY a.fecha_agendada DESC, a.fecha_creacion DESC
        ''', (cliente_id,))
        
        agendamientos = [dict(row) for row in cursor.fetchall()]
        return jsonify(agendamientos)
    except Exception as e:
        print(f"Error al obtener agendamientos del cliente: {e}")
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
            WHERE fecha = %s AND tipo_combustible = 'gasolina'
        ''', (hoy,))
        limites_hoy = cursor.fetchone()
        
        # Límites de mañana
        cursor.execute('''
            SELECT litros_agendados 
            FROM limites_diarios 
            WHERE fecha = %s AND tipo_combustible = 'gasolina'
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
        cursor.execute('UPDATE sistema_config SET retiros_bloqueados = %s WHERE id = 1', (1 if bloqueado else 0,))
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
            WHERE activo = TRUE
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
        cursor.execute('SELECT * FROM inventario WHERE tipo_combustible = %s ORDER BY id DESC LIMIT 1', ('gasoil',))
        gasoil = cursor.fetchone()
        
        cursor.execute('SELECT * FROM inventario WHERE tipo_combustible = %s ORDER BY id DESC LIMIT 1', ('gasolina',))
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
        cursor.execute('SELECT * FROM inventario WHERE tipo_combustible = %s ORDER BY id DESC LIMIT 1', (tipo_combustible,))
        inventario_actual = cursor.fetchone()
        
        litros_disponibles = (dict(inventario_actual)['litros_disponibles'] if inventario_actual else 0) + litros_ingresados
        
        # Insertar nuevo registro de inventario
        cursor.execute('''
            INSERT INTO inventario (tipo_combustible, litros_ingresados, litros_disponibles, usuario_id, observaciones)
            VALUES (%s, %s, %s, %s, %s)
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
        cursor.execute('SELECT id FROM inventario WHERE tipo_combustible = %s ORDER BY id DESC LIMIT 1', ('gasoil',))
        gasoil_record = cursor.fetchone()
        if gasoil_record:
            cursor.execute('UPDATE inventario SET litros_disponibles = 0 WHERE id = %s', (dict(gasoil_record)['id'],))
        
        # Obtener el último registro de gasolina
        cursor.execute('SELECT id FROM inventario WHERE tipo_combustible = %s ORDER BY id DESC LIMIT 1', ('gasolina',))
        gasolina_record = cursor.fetchone()
        if gasolina_record:
            cursor.execute('UPDATE inventario SET litros_disponibles = 0 WHERE id = %s', (dict(gasolina_record)['id'],))
        
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
