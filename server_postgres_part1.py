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
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'tu_clave_secreta_muy_segura')

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
            port=result.port
        )
        g.db.set_session(autocommit=False)
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

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

