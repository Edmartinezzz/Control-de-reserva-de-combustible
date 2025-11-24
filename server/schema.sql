-- PostgreSQL Schema for Despacho Gas
-- This schema includes the fecha_ultimo_reset column from the start

-- Tabla de usuarios (administradores)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  usuario TEXT UNIQUE NOT NULL,
  contrasena TEXT NOT NULL,
  nombre TEXT NOT NULL,
  es_admin BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT NOT NULL,
  cedula TEXT UNIQUE NOT NULL,
  rif TEXT,
  placa TEXT,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  litros_mes REAL DEFAULT 0,
  litros_disponibles REAL DEFAULT 0,
  litros_mes_gasolina REAL DEFAULT 0,
  litros_mes_gasoil REAL DEFAULT 0,
  litros_disponibles_gasolina REAL DEFAULT 0,
  litros_disponibles_gasoil REAL DEFAULT 0,
  exonerado BOOLEAN DEFAULT FALSE,
  huella BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de subclientes (trabajadores)
CREATE TABLE IF NOT EXISTS subclientes (
  id SERIAL PRIMARY KEY,
  cliente_padre_id INTEGER NOT NULL REFERENCES clientes(id),
  nombre TEXT NOT NULL,
  cedula TEXT,
  placa TEXT,
  litros_mes_gasolina REAL DEFAULT 0,
  litros_mes_gasoil REAL DEFAULT 0,
  litros_disponibles_gasolina REAL DEFAULT 0,
  litros_disponibles_gasoil REAL DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de inventario
CREATE TABLE IF NOT EXISTS inventario (
  id SERIAL PRIMARY KEY,
  tipo_combustible TEXT NOT NULL CHECK (tipo_combustible IN ('gasoil', 'gasolina')),
  litros_ingresados REAL NOT NULL,
  litros_disponibles REAL NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  observaciones TEXT,
  fecha_ingreso TIMESTAMP DEFAULT NOW()
);

-- Tabla de retiros
CREATE TABLE IF NOT EXISTS retiros (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  tipo_combustible TEXT NOT NULL CHECK (tipo_combustible IN ('gasoil', 'gasolina')),
  litros REAL NOT NULL,
  codigo_ticket INTEGER,
  fecha TIMESTAMP DEFAULT NOW()
);

-- Tabla de agendamientos
CREATE TABLE IF NOT EXISTS agendamientos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  subcliente_id INTEGER REFERENCES subclientes(id),
  tipo_combustible TEXT NOT NULL CHECK (tipo_combustible IN ('gasoil', 'gasolina')),
  litros REAL NOT NULL,
  fecha_agendada DATE NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT NOW(),
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'procesado', 'cancelado')),
  codigo_ticket INTEGER,
  procesado_por INTEGER REFERENCES usuarios(id),
  fecha_procesado TIMESTAMP,
  observaciones TEXT
);

-- Tabla de contador de tickets
CREATE TABLE IF NOT EXISTS ticket_counter (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  current_number INTEGER NOT NULL DEFAULT 0,
  last_reset_date TEXT NOT NULL DEFAULT CURRENT_DATE
);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS sistema_config (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  retiros_bloqueados INTEGER NOT NULL DEFAULT 0,
  limite_diario_gasolina REAL NOT NULL DEFAULT 2000,
  fecha_actualizacion TIMESTAMP DEFAULT NOW(),
  fecha_ultimo_reset TEXT  -- ✅ COLUMNA INCLUIDA DESDE EL INICIO
);

-- Tabla de límites diarios
CREATE TABLE IF NOT EXISTS limites_diarios (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tipo_combustible TEXT NOT NULL CHECK (tipo_combustible IN ('gasoil', 'gasolina')),
  litros_agendados REAL DEFAULT 0,
  litros_procesados REAL DEFAULT 0,
  UNIQUE(fecha, tipo_combustible)
);

-- Insertar configuración inicial
INSERT INTO sistema_config (id, retiros_bloqueados, limite_diario_gasolina, fecha_ultimo_reset)
VALUES (1, 0, 2000, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- Insertar contador de tickets inicial
INSERT INTO ticket_counter (id, current_number, last_reset_date)
VALUES (1, 0, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes(cedula);
CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
CREATE INDEX IF NOT EXISTS idx_retiros_cliente ON retiros(cliente_id);
CREATE INDEX IF NOT EXISTS idx_retiros_fecha ON retiros(fecha);
CREATE INDEX IF NOT EXISTS idx_agendamientos_cliente ON agendamientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_agendamientos_fecha ON agendamientos(fecha_agendada);
CREATE INDEX IF NOT EXISTS idx_agendamientos_estado ON agendamientos(estado);
