require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = (process.env.FRONTEND_ORIGINS || process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

console.log('Allowed Origins:', allowedOrigins);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Función helper para obtener fecha local (hora del computador)
function getLocalDate() {
  const now = new Date();
  // Ajustar a hora local del servidor
  return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

// Configuración de la base de datos SQLite
let db;
async function initDB() {
  db = await open({
    filename: './gas_delivery.db',
    driver: sqlite3.Database
  });

  // Crear tablas si no existen
  await db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      contrasena TEXT NOT NULL,
      nombre TEXT NOT NULL,
      es_admin BOOLEAN DEFAULT 0,
      activo BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      direccion TEXT,
      telefono TEXT NOT NULL,
      cedula TEXT UNIQUE NOT NULL,
      categoria TEXT NOT NULL DEFAULT 'Persona Natural',
      litros_mes REAL DEFAULT 0,
      litros_disponibles REAL DEFAULT 0,
      activo BOOLEAN DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Crear índice para búsquedas por cédula
    CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes(cedula);
    
    -- Crear índice para búsquedas por teléfono
    CREATE INDEX IF NOT EXISTS idx_clientes_telefono ON clientes(telefono);
  `);

  // Agregar columnas nuevas si no existen (para migración)
  try {
    await db.run('ALTER TABLE clientes ADD COLUMN subcategoria TEXT');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE clientes ADD COLUMN exonerado BOOLEAN DEFAULT 0');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE clientes ADD COLUMN huella BOOLEAN DEFAULT 0');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE clientes ADD COLUMN rif TEXT');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE clientes ADD COLUMN placa TEXT');
  } catch (e) {
    // La columna ya existe
  }

  // Agregar columnas para litros separados por tipo de combustible
  try {
    await db.run('ALTER TABLE clientes ADD COLUMN litros_mes_gasolina REAL DEFAULT 0');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE clientes ADD COLUMN litros_mes_gasoil REAL DEFAULT 0');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE clientes ADD COLUMN litros_disponibles_gasolina REAL DEFAULT 0');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE clientes ADD COLUMN litros_disponibles_gasoil REAL DEFAULT 0');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE inventario ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
  } catch (e) {
    // La columna ya existe
  }

  // Agregar columna tipo_combustible a retiros si no existe
  try {
    await db.run('ALTER TABLE retiros ADD COLUMN tipo_combustible TEXT DEFAULT "gasoil"');
  } catch (e) {
    // La columna ya existe
  }

  await db.exec(`

    -- Tabla de inventario
    CREATE TABLE IF NOT EXISTS inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_combustible TEXT NOT NULL CHECK(tipo_combustible IN ('gasoil', 'gasolina')),
      litros_ingresados REAL NOT NULL,
      litros_disponibles REAL NOT NULL,
      fecha_ingreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      usuario_id INTEGER,
      observaciones TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    );
    
    -- Índice para búsquedas por tipo de combustible
    CREATE INDEX IF NOT EXISTS idx_inventario_tipo ON inventario(tipo_combustible);

    -- Índice para búsquedas por fecha
    CREATE INDEX IF NOT EXISTS idx_inventario_fecha ON inventario(fecha_ingreso);

    CREATE TABLE IF NOT EXISTS retiros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      tipo_combustible TEXT NOT NULL CHECK(tipo_combustible IN ('gasoil', 'gasolina')),
      litros REAL NOT NULL,
      codigo_ticket INTEGER,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes (id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    );
    
    -- Índice para búsquedas por tipo de combustible en retiros
    CREATE INDEX IF NOT EXISTS idx_retiros_tipo ON retiros(tipo_combustible);
    
    -- Tabla para control de contador de tickets (1-200) con reinicio diario
    CREATE TABLE IF NOT EXISTS ticket_counter (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      current_number INTEGER NOT NULL DEFAULT 0,
      last_reset_date TEXT NOT NULL DEFAULT (date('now'))
    );
    
    -- Tabla para control de bloqueo global de retiros
    CREATE TABLE IF NOT EXISTS sistema_config (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      retiros_bloqueados INTEGER NOT NULL DEFAULT 0,
      limite_diario_gasolina REAL NOT NULL DEFAULT 2000,
      fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Tabla para control de límites diarios consumidos
    CREATE TABLE IF NOT EXISTS limites_diarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha DATE NOT NULL,
      tipo_combustible TEXT NOT NULL CHECK(tipo_combustible IN ('gasoil', 'gasolina')),
      litros_agendados REAL NOT NULL DEFAULT 0,
      litros_procesados REAL NOT NULL DEFAULT 0,
      UNIQUE(fecha, tipo_combustible)
    );
    
    -- Tabla para agendamientos de retiros
    CREATE TABLE IF NOT EXISTS agendamientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo_combustible TEXT NOT NULL CHECK(tipo_combustible IN ('gasoil', 'gasolina')),
      litros REAL NOT NULL,
      fecha_agendada DATE NOT NULL,
      fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'procesado', 'cancelado')),
      codigo_ticket INTEGER,
      observaciones TEXT,
      procesado_por INTEGER,
      fecha_procesado TIMESTAMP,
      subcliente_id INTEGER,
      FOREIGN KEY (cliente_id) REFERENCES clientes (id),
      FOREIGN KEY (procesado_por) REFERENCES usuarios (id),
      FOREIGN KEY (subcliente_id) REFERENCES subclientes (id)
    );
    
    -- Índices para agendamientos
    CREATE INDEX IF NOT EXISTS idx_agendamientos_cliente ON agendamientos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_agendamientos_fecha ON agendamientos(fecha_agendada);
    CREATE INDEX IF NOT EXISTS idx_agendamientos_estado ON agendamientos(estado);

    -- Tabla de subclientes (trabajadores asociados a un cliente padre)
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
    );

    CREATE INDEX IF NOT EXISTS idx_subclientes_cliente_padre ON subclientes(cliente_padre_id);
  `);

  // Crear o actualizar usuario administrador
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  // Verificar si el usuario admin ya existe
  const adminExists = await db.get('SELECT * FROM usuarios WHERE usuario = ?', ['admin']);

  if (!adminExists) {
    await db.run(
      'INSERT INTO usuarios (usuario, contrasena, nombre, es_admin) VALUES (?, ?, ?, ?)',
      ['admin', hashedPassword, 'Administrador', 1]
    );
    console.log('Usuario administrador creado');
  } else {
    await db.run(
      'UPDATE usuarios SET contrasena = ?, nombre = ?, es_admin = ? WHERE usuario = ?',
      [hashedPassword, 'Administrador', 1, 'admin']
    );
    console.log('Usuario administrador actualizado');
  }

  // Inicializar inventario si no existe
  const gasoilExists = await db.get('SELECT * FROM inventario WHERE tipo_combustible = ?', ['gasoil']);
  if (!gasoilExists) {
    await db.run(
      'INSERT INTO inventario (tipo_combustible, litros_ingresados, litros_disponibles, usuario_id, observaciones) VALUES (?, ?, ?, ?, ?)',
      ['gasoil', 0, 0, 1, 'Inventario inicial']
    );
    console.log('Inventario de gasoil inicializado');
  }

  const gasolinaExists = await db.get('SELECT * FROM inventario WHERE tipo_combustible = ?', ['gasolina']);
  if (!gasolinaExists) {
    await db.run(
      'INSERT INTO inventario (tipo_combustible, litros_ingresados, litros_disponibles, usuario_id, observaciones) VALUES (?, ?, ?, ?, ?)',
      ['gasolina', 0, 0, 1, 'Inventario inicial']
    );
    console.log('Inventario de gasolina inicializado');
  }

  // Inicializar contador de tickets si no existe
  const counterExists = await db.get('SELECT * FROM ticket_counter WHERE id = 1');
  if (!counterExists) {
    await db.run("INSERT INTO ticket_counter (id, current_number, last_reset_date) VALUES (1, 0, date('now'))");
    console.log('Contador de tickets inicializado');
  }

  // Inicializar configuración del sistema si no existe
  const configExists = await db.get('SELECT * FROM sistema_config WHERE id = 1');
  if (!configExists) {
    await db.run('INSERT INTO sistema_config (id, retiros_bloqueados) VALUES (1, 0)');
    console.log('Configuración del sistema inicializada');
  }

  // Agregar columna codigo_ticket a retiros si no existe
  try {
    await db.run('ALTER TABLE retiros ADD COLUMN codigo_ticket INTEGER');
    console.log('Columna codigo_ticket agregada a retiros');
  } catch (e) {
    // La columna ya existe
  }

  // Agregar columna last_reset_date a ticket_counter si no existe
  try {
    // Verificar si la columna existe
    const tableInfo = await db.all("PRAGMA table_info(ticket_counter)");
    const hasLastResetDate = tableInfo.some(col => col.name === 'last_reset_date');

    if (!hasLastResetDate) {
      // Agregar columna sin valor por defecto
      await db.run("ALTER TABLE ticket_counter ADD COLUMN last_reset_date TEXT");
      console.log('✅ Columna last_reset_date agregada a ticket_counter');

      // Actualizar el registro existente con la fecha actual
      await db.run("UPDATE ticket_counter SET last_reset_date = date('now') WHERE id = 1");
      console.log('✅ Fecha inicial establecida en ticket_counter');
    }
  } catch (e) {
    console.log('⚠️ Error al agregar columna last_reset_date:', e.message);
  }

  // Agregar columna limite_diario_gasolina a sistema_config si no existe
  try {
    await db.run('ALTER TABLE sistema_config ADD COLUMN limite_diario_gasolina REAL DEFAULT 2000');
    console.log('✅ Columna limite_diario_gasolina agregada a sistema_config');
  } catch (e) {
    // La columna ya existe
  }

  // Agregar columnas adicionales a agendamientos si no existen
  try {
    await db.run('ALTER TABLE agendamientos ADD COLUMN codigo_ticket INTEGER');
    console.log('✅ Columna codigo_ticket agregada a agendamientos');
  } catch (e) {
    // La columna ya existe
  }

  try {
    await db.run('ALTER TABLE agendamientos ADD COLUMN subcliente_id INTEGER');
    console.log('✅ Columna subcliente_id agregada a agendamientos');
  } catch (e) {
    // La columna ya existe
  }
}

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'tu_clave_secreta', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Obtener cliente por cédula
app.get('/api/clientes/cedula/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;

    const cliente = await db.get(
      'SELECT id, nombre, telefono, cedula, litros_mes, litros_disponibles, categoria, subcategoria, exonerado, huella FROM clientes WHERE cedula = ? AND activo = 1',
      [cedula]
    );

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    console.error('Error al buscar cliente por cédula:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener historial de retiros por cliente
app.get('/api/retiros/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;

    const retiros = await db.all(
      `SELECT r.id, r.litros, r.fecha, r.tipo_combustible 
       FROM retiros r 
       WHERE r.cliente_id = ? 
       ORDER BY r.fecha DESC`,
      [clienteId]
    );

    res.json(retiros);
  } catch (error) {
    console.error('Error al obtener historial de retiros:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener cliente por cédula
app.get('/api/clientes/cedula/:cedula', async (req, res) => {
  try {
    const { cedula } = req.params;

    const cliente = await db.get(
      'SELECT id, nombre, telefono, cedula, litros_mes, litros_disponibles, categoria, subcategoria, exonerado, huella FROM clientes WHERE cedula = ? AND activo = 1',
      [cedula]
    );

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    console.error('Error al buscar cliente por cédula:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Rutas de autenticación
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
      return res.status(400).json({ error: 'Se requieren usuario y contraseña' });
    }

    const user = await db.get('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);

    if (!user || !(await bcrypt.compare(contrasena, user.contrasena))) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, es_admin: user.es_admin },
      process.env.JWT_SECRET || 'tu_clave_secreta',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      usuario: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        es_admin: user.es_admin === 1
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Ruta para autenticación por cédula
app.post('/api/clientes/login', async (req, res) => {
  try {
    const { cedula } = req.body;

    // Validar que se proporcione la cédula
    if (!cedula) {
      return res.status(400).json({ error: 'La cédula es requerida' });
    }

    // Buscar al cliente por cédula
    const cliente = await db.get(
      'SELECT * FROM clientes WHERE cedula = ? AND activo = 1',
      [cedula]
    );

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado o inactivo' });
    }

    // Generar token JWT
    const token = jwt.sign(
      {
        id: cliente.id,
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        tipo: 'cliente'
      },
      process.env.JWT_SECRET || 'tu_clave_secreta',
      { expiresIn: '8h' }
    );

    // Devolver información del cliente (sin datos sensibles)
    res.json({
      token,
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        cedula: cliente.cedula,
        telefono: cliente.telefono,
        categoria: cliente.categoria,
        placa: cliente.placa,
        litros_disponibles: cliente.litros_disponibles,
        litros_mes: cliente.litros_mes,
        // Incluir campos separados por tipo de combustible
        litros_disponibles_gasolina: cliente.litros_disponibles_gasolina || 0,
        litros_disponibles_gasoil: cliente.litros_disponibles_gasoil || 0,
        litros_mes_gasolina: cliente.litros_mes_gasolina || 0,
        litros_mes_gasoil: cliente.litros_mes_gasoil || 0
      }
    });
  } catch (error) {
    console.error('Error en autenticación de cliente:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Ruta protegida de ejemplo
app.get('/api/dashboard', authenticateToken, (req, res) => {
  res.json({ message: 'Bienvenido al dashboard' });
});

// Registrar nuevo cliente (requiere autenticación)
app.post('/api/clientes', async (req, res) => {
  try {
    const {
      nombre,
      telefono,
      cedula,
      rif = null,
      placa = null,
      litros_mes, // Para compatibilidad con versiones anteriores
      litros_mes_gasolina,
      litros_mes_gasoil,
      categoria = 'Gobernación',
      subcategoria = null,
      exonerado = false,
      huella = false
    } = req.body;

    // Validaciones
    if (!nombre || !telefono || !cedula) {
      return res.status(400).json({ error: 'Nombre, teléfono y cédula son requeridos' });
    }

    // Manejar litros: usar los nuevos campos si están disponibles, sino usar el campo legacy
    let gasolinaLitros = 0;
    let gasoilLitros = 0;

    if (litros_mes_gasolina !== undefined && litros_mes_gasoil !== undefined) {
      gasolinaLitros = Number(litros_mes_gasolina) || 0;
      gasoilLitros = Number(litros_mes_gasoil) || 0;
    } else if (litros_mes !== undefined) {
      // Compatibilidad: asignar todo a gasolina si se usa el campo legacy
      gasolinaLitros = Number(litros_mes) || 0;
      gasoilLitros = 0;
    }

    // Validar que al menos uno tenga litros
    if (gasolinaLitros === 0 && gasoilLitros === 0) {
      return res.status(400).json({ error: 'Debe asignar litros a al menos un tipo de combustible' });
    }

    // Validar categoría
    const categoriasValidas = [
      'Gobernación',
      'Grupo Empresarial',
      'Alcaldía',
      'Categorias y Subcategorias',
      'Apoyos'
    ];

    if (categoria && !categoriasValidas.includes(categoria)) {
      return res.status(400).json({ error: 'Categoría no válida' });
    }

    // Validar formato de cédula venezolana (7 u 8 dígitos)
    const cedulaRegex = /^[0-9]{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
      return res.status(400).json({ error: 'La cédula debe tener 7 u 8 dígitos numéricos' });
    }

    // Verificar si el teléfono o la cédula ya están registrados
    const existingClient = await db.get(
      'SELECT id FROM clientes WHERE telefono = ? OR cedula = ?',
      [telefono, cedula]
    );

    if (existingClient) {
      return res.status(400).json({ error: 'El número telefónico o cédula ya están registrados' });
    }

    // Crear el cliente en la base de datos con campos separados
    const totalLitros = gasolinaLitros + gasoilLitros; // Para compatibilidad
    const result = await db.run(
      `INSERT INTO clientes (nombre, telefono, cedula, rif, placa, categoria, subcategoria, 
                           litros_mes, litros_disponibles, litros_mes_gasolina, litros_mes_gasoil, 
                           litros_disponibles_gasolina, litros_disponibles_gasoil, exonerado, huella, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [nombre, telefono, cedula, rif, placa, categoria, subcategoria,
        totalLitros, totalLitros, gasolinaLitros, gasoilLitros,
        gasolinaLitros, gasoilLitros, exonerado ? 1 : 0, huella ? 1 : 0]
    );

    // Crear usuario para el cliente (el teléfono será el usuario y contraseña)
    const hashedPassword = await bcrypt.hash(telefono, 10);
    await db.run(
      `INSERT INTO usuarios (usuario, contrasena, nombre, es_admin)
       VALUES (?, ?, ?, 0)`,
      [telefono, hashedPassword, nombre]
    );

    res.status(201).json({
      message: 'Cliente registrado exitosamente',
      clienteId: result.lastID
    });
  } catch (error) {
    console.error('Error al registrar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint simple para obtener lista de clientes (debe ir ANTES de /api/clientes/:id)
app.get('/api/clientes/simple', async (req, res) => {
  console.log('🔍 Petición recibida en /api/clientes/simple');
  try {
    const clientes = await db.all(`
      SELECT 
        id,
        nombre,
        cedula,
        telefono,
        placa,
        categoria,
        subcategoria,
        litros_mes,
        litros_disponibles
      FROM clientes 
      WHERE activo = 1 
      ORDER BY nombre ASC
    `);

    res.json(clientes);
  } catch (error) {
    console.error('Error al obtener lista simple de clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener cliente por ID
app.get('/api/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== ENDPOINTS PARA SUBCLIENTES ====================

// Obtener subclientes de un cliente padre
app.get('/api/clientes/:id/subclientes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el cliente padre existe
    const clientePadre = await db.get('SELECT id, nombre FROM clientes WHERE id = ? AND activo = 1', [id]);
    if (!clientePadre) {
      return res.status(404).json({ error: 'Cliente padre no encontrado' });
    }

    const subclientes = await db.all(
      `SELECT id, cliente_padre_id, nombre, cedula, placa,
              litros_mes_gasolina, litros_mes_gasoil,
              litros_disponibles_gasolina, litros_disponibles_gasoil,
              activo, created_at, updated_at
       FROM subclientes
       WHERE cliente_padre_id = ?
       ORDER BY nombre ASC`,
      [id]
    );

    res.json(subclientes);
  } catch (error) {
    console.error('Error al obtener subclientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear subcliente (trabajador) para un cliente padre
app.post('/api/clientes/:id/subclientes', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params; // id del cliente padre
    const {
      nombre,
      cedula = null,
      placa = null,
      litros_mes_gasolina = 0,
      litros_mes_gasoil = 0
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del subcliente es requerido' });
    }

    // Verificar cliente padre
    const clientePadre = await db.get(
      'SELECT id, nombre, litros_mes_gasolina, litros_mes_gasoil FROM clientes WHERE id = ? AND activo = 1',
      [id]
    );

    if (!clientePadre) {
      return res.status(404).json({ error: 'Cliente padre no encontrado' });
    }

    const gasolinaMesNuevo = Number(litros_mes_gasolina) || 0;
    const gasoilMesNuevo = Number(litros_mes_gasoil) || 0;

    // Obtener suma actual de litros asignados a subclientes de este padre
    const sumas = await db.get(
      `SELECT 
         COALESCE(SUM(litros_mes_gasolina), 0) AS total_gasolina,
         COALESCE(SUM(litros_mes_gasoil), 0) AS total_gasoil
       FROM subclientes
       WHERE cliente_padre_id = ? AND activo = 1`,
      [id]
    );

    const totalGasolinaAsignado = (sumas?.total_gasolina || 0) + gasolinaMesNuevo;
    const totalGasoilAsignado = (sumas?.total_gasoil || 0) + gasoilMesNuevo;

    // Validar que no exceda los litros mensuales del cliente padre
    const padreGasolinaMes = clientePadre.litros_mes_gasolina || 0;
    const padreGasoilMes = clientePadre.litros_mes_gasoil || 0;

    if (totalGasolinaAsignado > padreGasolinaMes || totalGasoilAsignado > padreGasoilMes) {
      return res.status(400).json({
        error: 'Los litros asignados a subclientes exceden los litros mensuales del cliente padre',
        padre_gasolina: padreGasolinaMes,
        padre_gasoil: padreGasoilMes,
        asignado_gasolina: totalGasolinaAsignado,
        asignado_gasoil: totalGasoilAsignado
      });
    }

    // Crear subcliente con litros disponibles iniciales = litros mensuales
    const result = await db.run(
      `INSERT INTO subclientes (
         cliente_padre_id, nombre, cedula, placa,
         litros_mes_gasolina, litros_mes_gasoil,
         litros_disponibles_gasolina, litros_disponibles_gasoil,
         activo
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        nombre,
        cedula,
        placa,
        gasolinaMesNuevo,
        gasoilMesNuevo,
        gasolinaMesNuevo,
        gasoilMesNuevo
      ]
    );

    // Recalcular litros disponibles del cliente padre
    await recalcularLitrosClientePadre(Number(id));

    res.status(201).json({
      message: 'Subcliente creado exitosamente',
      subclienteId: result.lastID
    });
  } catch (error) {
    console.error('Error al crear subcliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar subcliente (litros y datos básicos)
app.put('/api/subclientes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      cedula = null,
      placa = null,
      litros_mes_gasolina,
      litros_mes_gasoil,
      activo
    } = req.body;

    const subcliente = await db.get(
      'SELECT * FROM subclientes WHERE id = ?',
      [id]
    );

    if (!subcliente) {
      return res.status(404).json({ error: 'Subcliente no encontrado' });
    }

    const clientePadreId = subcliente.cliente_padre_id;

    const gasolinaMesNuevo =
      litros_mes_gasolina !== undefined ? (Number(litros_mes_gasolina) || 0) : (subcliente.litros_mes_gasolina || 0);
    const gasoilMesNuevo =
      litros_mes_gasoil !== undefined ? (Number(litros_mes_gasoil) || 0) : (subcliente.litros_mes_gasoil || 0);

    // Obtener suma de litros de otros subclientes del mismo padre
    const sumas = await db.get(
      `SELECT 
         COALESCE(SUM(litros_mes_gasolina), 0) AS total_gasolina,
         COALESCE(SUM(litros_mes_gasoil), 0) AS total_gasoil
       FROM subclientes
       WHERE cliente_padre_id = ? AND activo = 1 AND id != ?`,
      [clientePadreId, id]
    );

    const totalGasolinaAsignado = (sumas?.total_gasolina || 0) + gasolinaMesNuevo;
    const totalGasoilAsignado = (sumas?.total_gasoil || 0) + gasoilMesNuevo;

    const clientePadre = await db.get(
      'SELECT id, litros_mes_gasolina, litros_mes_gasoil FROM clientes WHERE id = ? AND activo = 1',
      [clientePadreId]
    );

    if (!clientePadre) {
      return res.status(404).json({ error: 'Cliente padre no encontrado' });
    }

    const padreGasolinaMes = clientePadre.litros_mes_gasolina || 0;
    const padreGasoilMes = clientePadre.litros_mes_gasoil || 0;

    if (totalGasolinaAsignado > padreGasolinaMes || totalGasoilAsignado > padreGasoilMes) {
      return res.status(400).json({
        error: 'Los litros asignados a subclientes exceden los litros mensuales del cliente padre',
        padre_gasolina: padreGasolinaMes,
        padre_gasoil: padreGasoilMes,
        asignado_gasolina: totalGasolinaAsignado,
        asignado_gasoil: totalGasoilAsignado
      });
    }

    // Actualizar datos del subcliente
    const nuevoNombre = nombre !== undefined ? nombre : subcliente.nombre;
    const nuevaCedula = cedula !== undefined ? cedula : subcliente.cedula;
    const nuevaPlaca = placa !== undefined ? placa : subcliente.placa;
    const nuevoActivo =
      activo !== undefined ? (activo ? 1 : 0) : subcliente.activo;

    // Cuando se cambian los litros mensuales, reiniciamos los disponibles a ese nuevo valor
    await db.run(
      `UPDATE subclientes 
       SET nombre = ?, cedula = ?, placa = ?,
           litros_mes_gasolina = ?, litros_mes_gasoil = ?,
           litros_disponibles_gasolina = ?, litros_disponibles_gasoil = ?,
           activo = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        nuevoNombre,
        nuevaCedula,
        nuevaPlaca,
        gasolinaMesNuevo,
        gasoilMesNuevo,
        gasolinaMesNuevo,
        gasoilMesNuevo,
        nuevoActivo,
        id
      ]
    );

    // Recalcular litros disponibles del cliente padre
    await recalcularLitrosClientePadre(clientePadreId);

    res.json({ message: 'Subcliente actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar subcliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar cliente
app.put('/api/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      telefono,
      cedula,
      litros_mes, // Para compatibilidad
      litros_mes_gasolina,
      litros_mes_gasoil,
      categoria,
      subcategoria = null,
      exonerado = false,
      huella = false
    } = req.body;

    // Validaciones
    if (!nombre || !telefono || !cedula) {
      return res.status(400).json({ error: 'Nombre, teléfono y cédula son requeridos' });
    }

    // Manejar litros: usar los nuevos campos si están disponibles, sino usar el campo legacy
    let gasolinaLitros = 0;
    let gasoilLitros = 0;

    if (litros_mes_gasolina !== undefined && litros_mes_gasoil !== undefined) {
      gasolinaLitros = Number(litros_mes_gasolina) || 0;
      gasoilLitros = Number(litros_mes_gasoil) || 0;
    } else if (litros_mes !== undefined) {
      // Compatibilidad: asignar todo a gasolina si se usa el campo legacy
      gasolinaLitros = Number(litros_mes) || 0;
      gasoilLitros = 0;
    }

    // Validar que al menos uno tenga litros
    if (gasolinaLitros === 0 && gasoilLitros === 0) {
      return res.status(400).json({ error: 'Debe asignar litros a al menos un tipo de combustible' });
    }

    // Validar categoría
    const categoriasValidas = [
      'Gobernación',
      'Grupo Empresarial',
      'Alcaldía',
      'Categorias y Subcategorias',
      'Apoyos'
    ];

    if (categoria && !categoriasValidas.includes(categoria)) {
      return res.status(400).json({ error: 'Categoría no válida' });
    }

    // Validar formato de cédula venezolana (7 u 8 dígitos)
    const cedulaRegex = /^[0-9]{7,8}$/;
    if (!cedulaRegex.test(cedula)) {
      return res.status(400).json({ error: 'La cédula debe tener 7 u 8 dígitos numéricos' });
    }

    // Verificar si el cliente existe
    const cliente = await db.get('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Verificar si el teléfono o cédula ya están en uso por otro cliente
    const existingClient = await db.get(
      'SELECT id FROM clientes WHERE (telefono = ? OR cedula = ?) AND id != ?',
      [telefono, cedula, id]
    );

    if (existingClient) {
      return res.status(400).json({ error: 'El número telefónico o cédula ya están registrados en otro cliente' });
    }

    // Actualizar el cliente con campos separados
    const totalLitros = gasolinaLitros + gasoilLitros; // Para compatibilidad
    await db.run(
      `UPDATE clientes 
       SET nombre = ?, telefono = ?, cedula = ?, categoria = ?, subcategoria = ?, 
           litros_mes = ?, litros_mes_gasolina = ?, litros_mes_gasoil = ?,
           exonerado = ?, huella = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [nombre, telefono, cedula, categoria, subcategoria, totalLitros, gasolinaLitros, gasoilLitros, exonerado ? 1 : 0, huella ? 1 : 0, id]
    );

    res.json({
      message: 'Cliente actualizado exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Registrar retiro de combustible (sin autenticación para permitir retiros de clientes)
app.post('/api/retiros', async (req, res) => {
  try {
    const { cliente_id, litros, tipo_combustible } = req.body;

    // Validaciones iniciales
    if (!tipo_combustible) {
      return res.status(400).json({
        error: 'Debe especificar el tipo de combustible (gasoil o gasolina)'
      });
    }

    const tipoCombustible = tipo_combustible.toLowerCase();
    if (!['gasoil', 'gasolina'].includes(tipoCombustible)) {
      return res.status(400).json({
        error: 'Tipo de combustible no válido. Debe ser "gasoil" o "gasolina"'
      });
    }

    // Verificar que hay suficiente inventario para el tipo de combustible
    const inventario = await db.get(
      'SELECT id, litros_disponibles FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      [tipoCombustible]
    );

    if (!inventario) {
      return res.status(400).json({
        error: `No hay inventario registrado de ${tipoCombustible}. Por favor, agregue inventario primero.`
      });
    }

    // Verificar si hay litros disponibles en el inventario
    if (inventario.litros_disponibles <= 0) {
      return res.status(400).json({
        error: 'No hay disponibilidad de combustible',
        detalles: `El inventario de ${tipoCombustible} está agotado. Por favor, recargue el inventario.`
      });
    }

    if (inventario.litros_disponibles < litros) {
      return res.status(400).json({
        error: 'No hay disponibilidad de combustible',
        detalles: `Solo hay ${inventario.litros_disponibles.toFixed(2)} L disponibles de ${tipoCombustible}. Solicitado: ${litros} L`
      });
    }

    // Verificar si los retiros están bloqueados
    const config = await db.get('SELECT retiros_bloqueados FROM sistema_config WHERE id = 1');
    if (config && config.retiros_bloqueados === 1) {
      return res.status(403).json({
        error: 'Sistema de retiros bloqueado',
        message: 'Los retiros están temporalmente bloqueados por el administrador. Por favor, intente más tarde.'
      });
    }

    if (!cliente_id || !litros) {
      return res.status(400).json({ error: 'Cliente ID y litros son requeridos' });
    }

    if (isNaN(litros) || litros <= 0) {
      return res.status(400).json({ error: 'La cantidad de litros debe ser mayor a cero' });
    }

    // Obtener datos del cliente
    const cliente = await db.get(
      'SELECT litros_disponibles FROM clientes WHERE id = ? AND activo = 1',
      [cliente_id]
    );

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (litros > cliente.litros_disponibles) {
      return res.status(400).json({
        error: `No hay suficientes litros disponibles. Disponible: ${cliente.litros_disponibles}`
      });
    }

    // Obtener y actualizar el contador de tickets (1-200) con reinicio diario
    let counter;
    try {
      counter = await db.get('SELECT current_number, last_reset_date FROM ticket_counter WHERE id = 1');
    } catch (error) {
      // Si la columna last_reset_date no existe, usar solo current_number
      console.log('Columna last_reset_date no encontrada, usando solo current_number');
      counter = await db.get('SELECT current_number FROM ticket_counter WHERE id = 1');
      counter.last_reset_date = null;
    }

    const today = getLocalDate(); // Obtener fecha local del computador

    let nextNumber;

    // Verificar si es un nuevo día y reiniciar el contador
    if (counter.last_reset_date && counter.last_reset_date !== today) {
      nextNumber = 1; // Reiniciar al primer número del día
      try {
        await db.run(
          'UPDATE ticket_counter SET current_number = ?, last_reset_date = ? WHERE id = 1',
          [nextNumber, today]
        );
      } catch (error) {
        // Si falla, actualizar solo current_number
        await db.run(
          'UPDATE ticket_counter SET current_number = ? WHERE id = 1',
          [nextNumber]
        );
      }
      console.log(`Contador de tickets reiniciado para el día ${today}`);
    } else {
      // Continuar con la secuencia del día actual
      nextNumber = (counter.current_number % 200) + 1; // Ciclo de 1 a 200
      await db.run(
        'UPDATE ticket_counter SET current_number = ? WHERE id = 1',
        [nextNumber]
      );
    }

    // Registrar el retiro con código de ticket
    const usuario_id = req.user?.id || 1; // Usar ID 1 (admin) si no hay usuario autenticado
    const resultRetiro = await db.run(
      'INSERT INTO retiros (cliente_id, usuario_id, tipo_combustible, litros, codigo_ticket) VALUES (?, ?, ?, ?, ?)',
      [cliente_id, usuario_id, tipoCombustible, litros, nextNumber]
    );

    // Actualizar el inventario restando los litros retirados del registro más reciente
    const nuevosLitrosDisponibles = inventario.litros_disponibles - litros;
    await db.run(
      'UPDATE inventario SET litros_disponibles = ? WHERE id = ?',
      [nuevosLitrosDisponibles, inventario.id]
    );

    // Actualizar litros disponibles del cliente
    await db.run(
      'UPDATE clientes SET litros_disponibles = litros_disponibles - ? WHERE id = ?',
      [litros, cliente_id]
    );

    res.status(201).json({
      message: `Retiro de ${litros} litros de ${tipoCombustible} registrado exitosamente`,
      retiroId: resultRetiro.lastID,
      codigo_ticket: nextNumber,
      tipo_combustible: tipoCombustible,
      litros_retirados: litros,
      inventario_disponible: nuevosLitrosDisponibles,
      cliente_litros_disponibles: cliente.litros_disponibles - litros,
      fecha: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al registrar retiro:', error);
    console.error('Detalles del error:', {
      message: error.message,
      stack: error.stack,
      cliente_id: req.body.cliente_id,
      litros: req.body.litros,
      tipo_combustible: req.body.tipo_combustible
    });
    res.status(500).json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener retiros de un cliente
app.get('/api/retiros/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const retiros = await db.all(
      'SELECT id, litros, fecha FROM retiros WHERE cliente_id = ? ORDER BY fecha DESC LIMIT 50',
      [clienteId]
    );

    res.json(retiros);
  } catch (error) {
    console.error('Error al obtener retiros:', error);
    res.status(500).json({ error: 'Error al obtener los retiros' });
  }
});

// Obtener todos los retiros (para admin)
app.get('/api/retiros', async (req, res) => {
  try {
    const retiros = await db.all(`
      SELECT 
        r.id, 
        r.litros, 
        r.fecha,
        r.codigo_ticket,
        c.nombre as cliente_nombre,
        c.cedula as cliente_cedula,
        c.telefono as cliente_telefono,
        c.placa as cliente_placa,
        c.categoria as cliente_categoria,
        c.subcategoria as cliente_subcategoria
      FROM retiros r
      JOIN clientes c ON r.cliente_id = c.id
      ORDER BY r.fecha DESC
      LIMIT 100
    `);

    res.json(retiros);
  } catch (error) {
    console.error('Error al obtener retiros:', error);
    res.status(500).json({ error: 'Error al obtener los retiros' });
  }
});

// ========== ENDPOINTS DE AGENDAMIENTOS (ELIMINADO - DUPLICADO) ==========

// Obtener agendamientos de un cliente
app.get('/api/agendamientos/cliente/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;

    const agendamientos = await db.all(
      `SELECT 
         a.id,
         a.tipo_combustible,
         a.litros,
         a.fecha_agendada,
         a.fecha_creacion,
         a.estado,
         a.codigo_ticket,
         a.observaciones,
         a.subcliente_id,
         s.nombre AS subcliente_nombre,
         s.cedula AS subcliente_cedula,
         s.placa AS subcliente_placa
       FROM agendamientos a
       LEFT JOIN subclientes s ON a.subcliente_id = s.id
       WHERE a.cliente_id = ? 
       ORDER BY a.fecha_agendada DESC, a.fecha_creacion DESC`,
      [clienteId]
    );

    res.json(agendamientos);
  } catch (error) {
    console.error('Error al obtener agendamientos del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener todos los agendamientos (para admin)
app.get('/api/agendamientos', async (req, res) => {
  try {
    const { fecha, estado } = req.query;

    let query = `
      SELECT 
        a.id, 
        a.tipo_combustible, 
        a.litros, 
        a.fecha_agendada, 
        a.fecha_creacion, 
        a.estado, 
        a.observaciones,
        c.nombre as cliente_nombre,
        c.cedula as cliente_cedula,
        c.telefono as cliente_telefono,
        c.categoria as cliente_categoria,
        a.subcliente_id,
        s.nombre AS subcliente_nombre,
        s.cedula AS subcliente_cedula,
        s.placa AS subcliente_placa
      FROM agendamientos a
      JOIN clientes c ON a.cliente_id = c.id
      LEFT JOIN subclientes s ON a.subcliente_id = s.id
    `;

    const params = [];
    const conditions = [];

    if (fecha) {
      conditions.push('a.fecha_agendada = ?');
      params.push(fecha);
    }

    if (estado) {
      conditions.push('a.estado = ?');
      params.push(estado);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.fecha_agendada ASC, a.fecha_creacion ASC';

    const agendamientos = await db.all(query, params);

    res.json(agendamientos);
  } catch (error) {
    console.error('Error al obtener agendamientos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Procesar agendamiento (convertir a retiro real)
app.post('/api/agendamientos/:id/procesar', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener el agendamiento
    const agendamiento = await db.get(
      `SELECT a.*, c.litros_disponibles, c.nombre as cliente_nombre
       FROM agendamientos a
       JOIN clientes c ON a.cliente_id = c.id
       WHERE a.id = ? AND a.estado = 'pendiente'`,
      [id]
    );

    if (!agendamiento) {
      return res.status(404).json({ error: 'Agendamiento no encontrado o ya procesado' });
    }

    // Verificar que el cliente aún tenga suficientes litros
    if (agendamiento.litros > agendamiento.litros_disponibles) {
      return res.status(400).json({
        error: `El cliente no tiene suficientes litros disponibles. Disponible: ${agendamiento.litros_disponibles}`
      });
    }

    // Verificar inventario disponible
    const inventario = await db.get(
      'SELECT id, litros_disponibles FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      [agendamiento.tipo_combustible]
    );

    if (!inventario || inventario.litros_disponibles < agendamiento.litros) {
      return res.status(400).json({
        error: 'No hay suficiente inventario disponible para procesar este agendamiento'
      });
    }

    // Obtener y actualizar contador de tickets
    const counter = await db.get('SELECT current_number, last_reset_date FROM ticket_counter WHERE id = 1');
    const today = getLocalDate();

    let nextNumber;
    if (counter.last_reset_date && counter.last_reset_date !== today) {
      nextNumber = 1;
      await db.run(
        'UPDATE ticket_counter SET current_number = ?, last_reset_date = ? WHERE id = 1',
        [nextNumber, today]
      );
    } else {
      nextNumber = (counter.current_number % 200) + 1;
      await db.run(
        'UPDATE ticket_counter SET current_number = ? WHERE id = 1',
        [nextNumber]
      );
    }

    // Crear el retiro
    const resultRetiro = await db.run(
      'INSERT INTO retiros (cliente_id, usuario_id, tipo_combustible, litros, codigo_ticket) VALUES (?, ?, ?, ?, ?)',
      [agendamiento.cliente_id, req.user.id, agendamiento.tipo_combustible, agendamiento.litros, nextNumber]
    );

    // Actualizar inventario
    const nuevosLitrosDisponibles = inventario.litros_disponibles - agendamiento.litros;
    await db.run(
      'UPDATE inventario SET litros_disponibles = ? WHERE id = ?',
      [nuevosLitrosDisponibles, inventario.id]
    );

    // Actualizar litros del cliente
    await db.run(
      'UPDATE clientes SET litros_disponibles = litros_disponibles - ? WHERE id = ?',
      [agendamiento.litros, agendamiento.cliente_id]
    );

    // Marcar agendamiento como procesado
    await db.run(
      'UPDATE agendamientos SET estado = "procesado", procesado_por = ?, fecha_procesado = CURRENT_TIMESTAMP WHERE id = ?',
      [req.user.id, id]
    );

    res.json({
      message: 'Agendamiento procesado exitosamente',
      retiroId: resultRetiro.lastID,
      codigo_ticket: nextNumber,
      cliente: agendamiento.cliente_nombre,
      litros: agendamiento.litros,
      tipo_combustible: agendamiento.tipo_combustible
    });
  } catch (error) {
    console.error('Error al procesar agendamiento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cancelar agendamiento
app.delete('/api/agendamientos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cliente_id } = req.query; // Para validar que el cliente puede cancelar su propio agendamiento

    let query = 'UPDATE agendamientos SET estado = "cancelado" WHERE id = ? AND estado = "pendiente"';
    let params = [id];

    // Si se proporciona cliente_id, validar que sea el dueño del agendamiento
    if (cliente_id) {
      query += ' AND cliente_id = ?';
      params.push(cliente_id);
    }

    const result = await db.run(query, params);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Agendamiento no encontrado o no se puede cancelar' });
    }

    res.json({ message: 'Agendamiento cancelado exitosamente' });
  } catch (error) {
    console.error('Error al cancelar agendamiento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estadísticas generales para el dashboard
app.get('/api/estadisticas', async (req, res) => {
  try {
    // Obtener total de clientes activos
    const clientesActivos = await db.get(
      'SELECT COUNT(*) as total FROM clientes WHERE activo = 1'
    );

    // Obtener total de litros entregados (todos los retiros)
    const litrosEntregados = await db.get(
      'SELECT COALESCE(SUM(litros), 0) as total FROM retiros'
    );

    // Obtener el inventario actual
    const inventario = await db.get(
      'SELECT litros_disponibles FROM inventario ORDER BY id DESC LIMIT 1'
    );

    // Obtener el próximo vencimiento (podrías implementar esta lógica según tus necesidades)
    const proximoVencimiento = 0; // Por ahora lo dejamos en 0

    res.json({
      totalClientes: clientesActivos?.total || 0,
      totalLitrosEntregados: litrosEntregados?.total || 0,
      inventarioActual: inventario?.litros_disponibles || 0,
      proximoVencimiento: proximoVencimiento
    });
  } catch (error) {
    console.error('Error al obtener estadísticas generales:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas generales' });
  }
});

// Obtener estadísticas de retiros por día, mes y año
app.get('/api/estadisticas/retiros', async (req, res) => {
  try {
    // Litros retirados hoy
    const hoy = await db.get(`
      SELECT COALESCE(SUM(litros), 0) as total
      FROM retiros
      WHERE DATE(fecha) = DATE('now', 'localtime')
    `);

    // Litros retirados este mes
    const esteMes = await db.get(`
      SELECT COALESCE(SUM(litros), 0) as total
      FROM retiros
      WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now', 'localtime')
    `);

    // Litros retirados este año
    const esteAno = await db.get(`
      SELECT COALESCE(SUM(litros), 0) as total
      FROM retiros
      WHERE strftime('%Y', fecha) = strftime('%Y', 'now', 'localtime')
    `);

    // Clientes únicos que retiraron hoy
    const clientesHoy = await db.get(`
      SELECT COUNT(DISTINCT cliente_id) as total
      FROM retiros
      WHERE DATE(fecha) = DATE('now', 'localtime')
    `);

    // Litros por mes (últimos 12 meses)
    const litrosPorMes = await db.all(`
      SELECT 
        strftime('%Y-%m', fecha) as mes,
        SUM(litros) as total
      FROM retiros
      WHERE fecha >= date('now', '-12 months', 'localtime')
      GROUP BY strftime('%Y-%m', fecha)
      ORDER BY mes ASC
    `);

    // Retiros por día (últimos 7 días)
    const retirosPorDia = await db.all(`
      SELECT 
        DATE(fecha) as dia,
        SUM(litros) as total,
        COUNT(DISTINCT cliente_id) as clientes
      FROM retiros
      WHERE fecha >= date('now', '-7 days', 'localtime')
      GROUP BY DATE(fecha)
      ORDER BY dia ASC
    `);

    res.json({
      litrosHoy: hoy?.total || 0,
      litrosMes: esteMes?.total || 0,
      litrosAno: esteAno?.total || 0,
      clientesHoy: clientesHoy?.total || 0,
      litrosPorMes: litrosPorMes || [],
      retirosPorDia: retirosPorDia || []
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de retiros:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// Obtener lista de todos los clientes registrados con estadísticas de retiros
app.get('/api/clientes/lista', async (req, res) => {
  try {
    const clientes = await db.all(`
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
        c.created_at,
        COUNT(r.id) as total_retiros,
        COALESCE(SUM(r.litros), 0) as total_litros_retirados,
        MAX(r.fecha) as ultimo_retiro
      FROM clientes c
      LEFT JOIN retiros r ON c.id = r.cliente_id
      WHERE c.activo = 1 
      GROUP BY c.id
      ORDER BY c.nombre ASC
    `);

    // Formatear los datos para la respuesta
    const clientesFormateados = clientes.map(cliente => ({
      id: cliente.id,
      nombre: cliente.nombre,
      cedula: cliente.cedula,
      telefono: cliente.telefono,
      placa: cliente.placa || 'N/A',
      categoria: cliente.categoria,
      subcategoria: cliente.subcategoria || 'N/A',
      litros_mes: cliente.litros_mes,
      litros_disponibles: cliente.litros_disponibles,
      fecha_registro: cliente.created_at,
      total_retiros: cliente.total_retiros,
      total_litros_retirados: cliente.total_litros_retirados,
      ultimo_retiro: cliente.ultimo_retiro
    }));

    res.json(clientesFormateados);
  } catch (error) {
    console.error('Error al obtener lista de clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener tickets de retiro de un cliente específico
app.get('/api/clientes/:clienteId/tickets', async (req, res) => {
  try {
    const { clienteId } = req.params;

    const tickets = await db.all(`
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
    `, [clienteId]);

    res.json(tickets);
  } catch (error) {
    console.error('Error al obtener tickets del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Buscar cliente por teléfono (sin autenticación)
app.get('/api/clientes/telefono/:telefono', async (req, res) => {
  try {
    const { telefono } = req.params;
    const cliente = await db.get(
      'SELECT id, nombre, direccion, telefono, cedula, litros_mes as litrosMes, litros_disponibles as litrosDisponibles, categoria, subcategoria, exonerado, huella, activo FROM clientes WHERE telefono = ? AND activo = 1',
      [telefono]
    );

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({
      id: cliente.id,
      nombre: cliente.nombre,
      direccion: cliente.direccion,
      telefono: cliente.telefono,
      cedula: cliente.cedula,
      litros_mes: cliente.litrosMes,
      litros_disponibles: cliente.litrosDisponibles,
      categoria: cliente.categoria,
      subcategoria: cliente.subcategoria,
      exonerado: cliente.exonerado === 1,
      huella: cliente.huella === 1,
      activo: cliente.activo === 1
    });
  } catch (error) {
    console.error('Error al buscar cliente:', error);
    res.status(500).json({ error: 'Error al buscar el cliente' });
  }
});

// Rutas de inventario
app.get('/api/inventario', async (req, res) => {
  try {
    // Obtener el último registro de cada tipo de combustible
    const gasoil = await db.get(
      'SELECT * FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      ['gasoil']
    );

    const gasolina = await db.get(
      'SELECT * FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      ['gasolina']
    );

    // Devolver un array con ambos tipos
    const inventario = [];
    if (gasoil) inventario.push(gasoil);
    if (gasolina) inventario.push(gasolina);

    res.json(inventario);
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    res.status(500).json({ error: 'Error al obtener el inventario' });
  }
});

app.get('/api/inventario/historial', async (req, res) => {
  try {
    const historial = await db.all(`
      SELECT i.*, u.usuario as usuario_nombre 
      FROM inventario i 
      LEFT JOIN usuarios u ON i.usuario_id = u.id 
      ORDER BY i.fecha_ingreso DESC
    `);
    res.json(historial);
  } catch (error) {
    console.error('Error al obtener historial de inventario:', error);
    res.status(500).json({ error: 'Error al obtener el historial de inventario' });
  }
});

// Obtener estado de bloqueo de retiros
app.get('/api/sistema/bloqueo', async (req, res) => {
  try {
    const config = await db.get('SELECT retiros_bloqueados FROM sistema_config WHERE id = 1');
    res.json({
      bloqueado: config?.retiros_bloqueados === 1 || false
    });
  } catch (error) {
    console.error('Error al obtener estado de bloqueo:', error);
    res.status(500).json({ error: 'Error al obtener estado de bloqueo' });
  }
});

// Actualizar estado de bloqueo de retiros (solo admin)
app.post('/api/sistema/bloqueo', authenticateToken, async (req, res) => {
  try {
    const { bloqueado } = req.body;

    await db.run(
      'UPDATE sistema_config SET retiros_bloqueados = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = 1',
      [bloqueado ? 1 : 0]
    );

    console.log(`Sistema de retiros ${bloqueado ? 'BLOQUEADO' : 'DESBLOQUEADO'} por admin`);

    res.json({
      success: true,
      bloqueado,
      message: bloqueado ? 'Retiros bloqueados exitosamente' : 'Retiros desbloqueados exitosamente'
    });
  } catch (error) {
    console.error('Error al actualizar estado de bloqueo:', error);
    res.status(500).json({ error: 'Error al actualizar estado de bloqueo' });
  }
});

app.post('/api/inventario', authenticateToken, async (req, res) => {
  try {
    let { tipo_combustible, litros_ingresados, observaciones } = req.body;
    const usuario_id = req.user.id;

    // Normalizar el tipo de combustible
    tipo_combustible = String(tipo_combustible).toLowerCase().trim();

    if (!['gasoil', 'gasolina'].includes(tipo_combustible)) {
      return res.status(400).json({
        error: 'Tipo de combustible inválido. Use "gasoil" o "gasolina"',
        received: req.body.tipo_combustible,
        normalized: tipo_combustible
      });
    }

    if (!litros_ingresados || isNaN(litros_ingresados) || litros_ingresados <= 0) {
      return res.status(400).json({ error: 'Ingrese una cantidad válida de litros' });
    }

    // Obtener el inventario actual para el tipo de combustible específico
    const inventarioActual = await db.get(
      'SELECT * FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      [tipo_combustible]
    );

    const litros_disponibles = (inventarioActual?.litros_disponibles || 0) + parseFloat(litros_ingresados);

    // Insertar nuevo registro de inventario
    const result = await db.run(
      'INSERT INTO inventario (tipo_combustible, litros_ingresados, litros_disponibles, usuario_id, observaciones) VALUES (?, ?, ?, ?, ?)',
      [tipo_combustible, parseFloat(litros_ingresados), litros_disponibles, usuario_id, observaciones || null]
    );

    res.status(201).json({
      id: result.lastID,
      litros_ingresados: parseFloat(litros_ingresados),
      litros_disponibles,
      usuario_id,
      observaciones: observaciones || null
    });
  } catch (error) {
    console.error('Error al actualizar inventario:', error);
    res.status(500).json({ error: 'Error al actualizar el inventario' });
  }
});

// Resetear inventario a 0
app.post('/api/inventario/reset', authenticateToken, async (req, res) => {
  try {
    const usuario_id = req.user.id;

    // Obtener el último registro de gasoil
    const gasoilRecord = await db.get(
      'SELECT id FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      ['gasoil']
    );

    if (gasoilRecord) {
      await db.run(
        'UPDATE inventario SET litros_disponibles = 0 WHERE id = ?',
        [gasoilRecord.id]
      );
    }

    // Obtener el último registro de gasolina
    const gasolinaRecord = await db.get(
      'SELECT id FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      ['gasolina']
    );

    if (gasolinaRecord) {
      await db.run(
        'UPDATE inventario SET litros_disponibles = 0 WHERE id = ?',
        [gasolinaRecord.id]
      );
    }

    res.json({
      message: 'Inventario reseteado a 0 litros',
      gasoil: 0,
      gasolina: 0
    });
  } catch (error) {
    console.error('Error al resetear inventario:', error);
    console.error('Detalles:', error.message, error.stack);
    res.status(500).json({
      error: 'Error al resetear el inventario',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Endpoint para ejecutar recarga manual (para pruebas)
app.post('/api/admin/recargar-litros-manual', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 Recarga manual solicitada por:', req.user.usuario);
    await recargarLitrosDiarios();
    res.json({
      success: true,
      message: 'Recarga manual ejecutada exitosamente'
    });
  } catch (error) {
    console.error('Error en recarga manual:', error);
    res.status(500).json({
      error: 'Error al ejecutar recarga manual',
      details: error.message
    });
  }
});

// Recalcular litros disponibles del cliente padre en función de los litros mensuales asignados a subclientes
async function recalcularLitrosClientePadre(clienteId) {
  try {
    const cliente = await db.get(
      'SELECT id, litros_mes_gasolina, litros_mes_gasoil FROM clientes WHERE id = ?',
      [clienteId]
    );

    if (!cliente) return;

    const sumas = await db.get(
      `SELECT 
         COALESCE(SUM(litros_mes_gasolina), 0) AS total_gasolina,
         COALESCE(SUM(litros_mes_gasoil), 0) AS total_gasoil
       FROM subclientes
       WHERE cliente_padre_id = ? AND activo = 1`,
      [clienteId]
    );

    const padreGasolinaMes = cliente.litros_mes_gasolina || 0;
    const padreGasoilMes = cliente.litros_mes_gasoil || 0;

    const totalGasolinaAsignado = sumas?.total_gasolina || 0;
    const totalGasoilAsignado = sumas?.total_gasoil || 0;

    const disponiblesGasolina = Math.max(padreGasolinaMes - totalGasolinaAsignado, 0);
    const disponiblesGasoil = Math.max(padreGasoilMes - totalGasoilAsignado, 0);

    const totalLitros = padreGasolinaMes + padreGasoilMes;

    await db.run(
      'UPDATE clientes SET litros_disponibles = ?, litros_disponibles_gasolina = ?, litros_disponibles_gasoil = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [totalLitros, disponiblesGasolina, disponiblesGasoil, clienteId]
    );
  } catch (error) {
    console.error('Error al recalcular litros del cliente padre:', error);
  }
}

// Función para recargar litros diarios automáticamente (RESTAURAR LITROS COMPLETOS)
async function recargarLitrosDiarios() {
  try {
    const fecha = new Date().toISOString();
    console.log(`[${fecha}] 🌙 Iniciando recarga automática a medianoche - RESTAURANDO LITROS COMPLETOS...`);

    // Obtener todos los clientes activos
    const clientes = await db.all('SELECT * FROM clientes WHERE activo = 1');

    let clientesRecargados = 0;

    for (const cliente of clientes) {
      const totalLitros = cliente.litros_mes || 0;
      const gasolinaLitros = cliente.litros_mes_gasolina || cliente.litros_mes || 0;
      const gasoilLitros = cliente.litros_mes_gasoil || 0;

      if (totalLitros > 0 || gasolinaLitros > 0 || gasoilLitros > 0) {
        // RESTAURAR LITROS COMPLETOS (tanto legacy como campos separados)
        await db.run(
          'UPDATE clientes SET litros_disponibles = ?, litros_disponibles_gasolina = ?, litros_disponibles_gasoil = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [totalLitros, gasolinaLitros, gasoilLitros, cliente.id]
        );

        clientesRecargados++;
        console.log(`  ✓ Cliente ${cliente.nombre} (ID: ${cliente.id}): RESTAURADO → ${gasolinaLitros}L gasolina + ${gasoilLitros}L gasoil (Total: ${totalLitros}L)`);
      }
    }

    // Restaurar litros de subclientes a sus litros mensuales
    const subclientes = await db.all('SELECT * FROM subclientes WHERE activo = 1');

    for (const sub of subclientes) {
      const gasolinaMes = sub.litros_mes_gasolina || 0;
      const gasoilMes = sub.litros_mes_gasoil || 0;

      await db.run(
        'UPDATE subclientes SET litros_disponibles_gasolina = ?, litros_disponibles_gasoil = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [gasolinaMes, gasoilMes, sub.id]
      );
    }

    // Recalcular litros disponibles de todos los clientes padres que tengan subclientes
    const padres = await db.all(
      'SELECT DISTINCT cliente_padre_id AS id FROM subclientes WHERE activo = 1'
    );

    for (const padre of padres) {
      if (padre.id) {
        await recalcularLitrosClientePadre(padre.id);
      }
    }

    console.log(`[${fecha}] 🌙 Recarga de medianoche completada: ${clientesRecargados} clientes con litros restaurados y subclientes recargados.`);
  } catch (error) {
    console.error('❌ Error en recarga automática de medianoche:', error);
  }
}

// Función para procesar agendamientos del día
async function procesarAgendamientosDelDia() {
  try {
    const hoy = getLocalDate();
    console.log(`🗓️ Procesando agendamientos para el día: ${hoy}`);

    // Obtener agendamientos pendientes para hoy
    const agendamientos = await db.all(
      `SELECT a.*, c.nombre as cliente_nombre, c.litros_disponibles
       FROM agendamientos a
       JOIN clientes c ON a.cliente_id = c.id
       WHERE a.fecha_agendada = ? AND a.estado = 'pendiente'
       ORDER BY a.fecha_creacion ASC`,
      [hoy]
    );

    if (agendamientos.length === 0) {
      console.log('📋 No hay agendamientos pendientes para procesar hoy');
      return;
    }

    console.log(`📋 Encontrados ${agendamientos.length} agendamientos para procesar`);

    let procesados = 0;
    let errores = 0;

    for (const agendamiento of agendamientos) {
      try {
        // Verificar que el cliente aún tenga suficientes litros
        if (agendamiento.litros > agendamiento.litros_disponibles) {
          console.log(`⚠️ Cliente ${agendamiento.cliente_nombre} no tiene suficientes litros (${agendamiento.litros_disponibles}/${agendamiento.litros})`);
          errores++;
          continue;
        }

        // Verificar inventario disponible
        const inventario = await db.get(
          'SELECT id, litros_disponibles FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
          [agendamiento.tipo_combustible]
        );

        if (!inventario || inventario.litros_disponibles < agendamiento.litros) {
          console.log(`⚠️ No hay suficiente inventario de ${agendamiento.tipo_combustible} (${inventario?.litros_disponibles || 0}/${agendamiento.litros})`);
          errores++;
          continue;
        }

        // Obtener y actualizar contador de tickets
        const counter = await db.get('SELECT current_number, last_reset_date FROM ticket_counter WHERE id = 1');

        let nextNumber;
        if (counter.last_reset_date && counter.last_reset_date !== hoy) {
          nextNumber = 1;
          await db.run(
            'UPDATE ticket_counter SET current_number = ?, last_reset_date = ? WHERE id = 1',
            [nextNumber, hoy]
          );
        } else {
          nextNumber = (counter.current_number % 200) + 1;
          await db.run(
            'UPDATE ticket_counter SET current_number = ? WHERE id = 1',
            [nextNumber]
          );
        }

        // Crear el retiro
        const resultRetiro = await db.run(
          'INSERT INTO retiros (cliente_id, usuario_id, tipo_combustible, litros, codigo_ticket) VALUES (?, ?, ?, ?, ?)',
          [agendamiento.cliente_id, 1, agendamiento.tipo_combustible, agendamiento.litros, nextNumber] // usuario_id = 1 (admin automático)
        );

        // Actualizar inventario (restar del inventario físico)
        const nuevosLitrosDisponibles = inventario.litros_disponibles - agendamiento.litros;
        await db.run(
          'UPDATE inventario SET litros_disponibles = ? WHERE id = ?',
          [nuevosLitrosDisponibles, inventario.id]
        );

        // NOTA: Los litros del cliente ya se restaron al agendar, no se vuelven a restar aquí

        // Marcar agendamiento como procesado
        await db.run(
          'UPDATE agendamientos SET estado = "procesado", procesado_por = ?, fecha_procesado = CURRENT_TIMESTAMP WHERE id = ?',
          [1, agendamiento.id] // procesado_por = 1 (admin automático)
        );

        console.log(`✅ Procesado: ${agendamiento.cliente_nombre} - ${agendamiento.litros}L ${agendamiento.tipo_combustible} - Ticket: ${nextNumber}`);
        procesados++;

      } catch (error) {
        console.error(`❌ Error procesando agendamiento ID ${agendamiento.id}:`, error);
        errores++;
      }
    }

    console.log(`📊 Resumen del procesamiento: ${procesados} exitosos, ${errores} errores`);

  } catch (error) {
    console.error('❌ Error en procesamiento automático de agendamientos:', error);
  }
}

// ==================== ENDPOINTS PARA AGENDAMIENTOS ====================

// Crear agendamiento (cliente / subcliente)
app.post('/api/agendamientos', async (req, res) => {
  console.log('🎫 Petición de agendamiento recibida:', req.body);
  try {
    const { cliente_id, tipo_combustible, litros, subcliente_id } = req.body;

    // Validaciones básicas
    if (!cliente_id || !tipo_combustible || !litros) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    if (!['gasoil', 'gasolina'].includes(tipo_combustible)) {
      return res.status(400).json({ error: 'Tipo de combustible inválido' });
    }

    if (litros <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a cero' });
    }

    // Verificar que el cliente existe y está activo
    const cliente = await db.get(
      'SELECT id, nombre, litros_disponibles, litros_disponibles_gasolina, litros_disponibles_gasoil FROM clientes WHERE id = ? AND activo = 1',
      [cliente_id]
    );

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Determinar contra quién se validan los litros: siempre contra el cliente padre.
    // Si se indica subcliente_id, solo se valida que exista y pertenezca al cliente.
    let litrosDisponiblesTipo;
    let esSubcliente = false;

    if (subcliente_id) {
      const subcliente = await db.get(
        'SELECT id FROM subclientes WHERE id = ? AND cliente_padre_id = ? AND activo = 1',
        [subcliente_id, cliente_id]
      );

      if (!subcliente) {
        return res.status(404).json({ error: 'Subcliente no encontrado o no pertenece al cliente indicado' });
      }

      esSubcliente = true;
    }

    litrosDisponiblesTipo = tipo_combustible === 'gasolina'
      ? (cliente.litros_disponibles_gasolina || cliente.litros_disponibles || 0)
      : (cliente.litros_disponibles_gasoil || 0);

    if (litros > litrosDisponiblesTipo) {
      return res.status(400).json({
        error: `No tiene suficientes litros de ${tipo_combustible} disponibles`,
        disponibles: litrosDisponiblesTipo,
        solicitados: litros
      });
    }

    // Calcular fecha del día siguiente
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const fechaAgendada = mañana.toISOString().split('T')[0];

    console.log(`📅 REAL: Fecha de hoy: ${new Date().toISOString().split('T')[0]}`);
    console.log(`📅 REAL: Fecha de retiro (mañana): ${fechaAgendada}`);

    // Verificar inventario disponible
    const inventario = await db.get(
      'SELECT litros_disponibles FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      [tipo_combustible]
    );

    if (!inventario || inventario.litros_disponibles < litros) {
      return res.status(400).json({
        error: 'No hay suficiente inventario disponible',
        disponible_inventario: inventario?.litros_disponibles || 0,
        solicitado: litros
      });
    }

    // Verificar límite diario global
    const config = await db.get('SELECT limite_diario_gasolina FROM sistema_config WHERE id = 1');
    const limiteGlobal = config?.limite_diario_gasolina || 2000;

    // Obtener litros ya agendados para mañana
    const agendadosHoy = await db.get(
      'SELECT COALESCE(SUM(litros), 0) as total FROM agendamientos WHERE fecha_agendada = ? AND tipo_combustible = ? AND estado = "pendiente"',
      [fechaAgendada, tipo_combustible]
    );

    const totalAgendado = agendadosHoy.total + litros;

    if (totalAgendado > limiteGlobal) {
      return res.status(400).json({
        error: 'Límite diario excedido',
        limite: limiteGlobal,
        agendado: agendadosHoy.total,
        solicitado: litros,
        disponible: limiteGlobal - agendadosHoy.total
      });
    }

    // Generar ticket
    const counter = await db.get('SELECT current_number FROM ticket_counter WHERE id = 1');
    const nextNumber = ((counter?.current_number || 0) % 200) + 1;

    // Actualizar contador
    await db.run('UPDATE ticket_counter SET current_number = ? WHERE id = 1', [nextNumber]);

    // Crear agendamiento
    const result = await db.run(
      'INSERT INTO agendamientos (cliente_id, tipo_combustible, litros, fecha_agendada, codigo_ticket, subcliente_id) VALUES (?, ?, ?, ?, ?, ?)',
      [cliente_id, tipo_combustible, litros, fechaAgendada, nextNumber, subcliente_id || null]
    );

    // RESTAR LITROS DISPONIBLES SIEMPRE DEL CLIENTE PADRE
    if (tipo_combustible === 'gasolina') {
      await db.run(
        'UPDATE clientes SET litros_disponibles = litros_disponibles - ?, litros_disponibles_gasolina = COALESCE(litros_disponibles_gasolina, litros_disponibles) - ? WHERE id = ?',
        [litros, litros, cliente_id]
      );
    } else {
      await db.run(
        'UPDATE clientes SET litros_disponibles = litros_disponibles - ?, litros_disponibles_gasoil = COALESCE(litros_disponibles_gasoil, 0) - ? WHERE id = ?',
        [litros, litros, cliente_id]
      );
    }

    // RESTAR LITROS DEL INVENTARIO INMEDIATAMENTE
    await db.run(
      'UPDATE inventario SET litros_disponibles = litros_disponibles - ? WHERE tipo_combustible = ? AND id = (SELECT MAX(id) FROM inventario WHERE tipo_combustible = ?)',
      [litros, tipo_combustible, tipo_combustible]
    );

    console.log(`📦 Inventario actualizado: -${litros}L de ${tipo_combustible}`);

    // Actualizar límites diarios
    await db.run(
      'INSERT OR REPLACE INTO limites_diarios (fecha, tipo_combustible, litros_agendados) VALUES (?, ?, COALESCE((SELECT litros_agendados FROM limites_diarios WHERE fecha = ? AND tipo_combustible = ?), 0) + ?)',
      [fechaAgendada, tipo_combustible, fechaAgendada, tipo_combustible, litros]
    );

    // Obtener inventario restante después de la actualización
    const inventarioRestante = await db.get(
      'SELECT litros_disponibles FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      [tipo_combustible]
    );

    console.log(`✅ Agendamiento creado - Cliente: ${cliente_id}, Ticket: ${nextNumber}, Litros: ${litros}L`);
    console.log(`📦 Inventario restante: ${inventarioRestante?.litros_disponibles || 0}L`);
    console.log(`📤 Enviando respuesta:`, {
      id: result.lastID,
      cliente_id,
      tipo_combustible,
      litros,
      fecha_agendada: fechaAgendada,
      codigo_ticket: nextNumber,
      inventario_restante: inventarioRestante?.litros_disponibles || 0,
      message: 'Agendamiento creado exitosamente'
    });

    res.status(201).json({
      id: result.lastID,
      cliente_id,
      tipo_combustible,
      litros,
      fecha_agendada: fechaAgendada,
      codigo_ticket: nextNumber,
      inventario_restante: inventarioRestante?.litros_disponibles || 0,
      message: 'Agendamiento creado exitosamente'
    });

  } catch (error) {
    console.error('Error al crear agendamiento:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para obtener estado del inventario
app.get('/api/inventario/estado', async (req, res) => {
  try {
    const inventarios = await db.all(
      'SELECT tipo_combustible, litros_disponibles FROM inventario ORDER BY id DESC'
    );

    // Obtener el último registro de cada tipo de combustible
    const estadoInventario = {};
    inventarios.forEach(inv => {
      if (!estadoInventario[inv.tipo_combustible]) {
        estadoInventario[inv.tipo_combustible] = inv.litros_disponibles;
      }
    });

    console.log('📦 Estado del inventario consultado:', estadoInventario);

    res.json({
      inventario: estadoInventario,
      disponible: Object.values(estadoInventario).some(litros => litros > 0)
    });
  } catch (error) {
    console.error('Error al obtener estado del inventario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener agendamientos del día (SIN AUTH PARA PRUEBAS)
app.get('/api/agendamientos/dia/:fecha', async (req, res) => {
  try {
    const { fecha } = req.params;

    const agendamientos = await db.all(`
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
      LEFT JOIN subclientes s ON a.subcliente_id = s.id
      WHERE a.fecha_agendada = ?
      ORDER BY a.codigo_ticket ASC
    `, [fecha]);

    res.json(agendamientos);

  } catch (error) {
    console.error('Error al obtener agendamientos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener límites y configuración (SIN AUTH PARA PRUEBAS)
app.get('/api/sistema/limites', async (req, res) => {
  try {
    const config = await db.get('SELECT limite_diario_gasolina FROM sistema_config WHERE id = 1');

    const hoy = new Date().toISOString().split('T')[0];
    const mañana = new Date();
    mañana.setDate(mañana.getDate() + 1);
    const fechaMañana = mañana.toISOString().split('T')[0];

    const limitesHoy = await db.get(
      'SELECT litros_agendados, litros_procesados FROM limites_diarios WHERE fecha = ? AND tipo_combustible = "gasolina"',
      [hoy]
    );

    const limitesMañana = await db.get(
      'SELECT litros_agendados FROM limites_diarios WHERE fecha = ? AND tipo_combustible = "gasolina"',
      [fechaMañana]
    );

    res.json({
      limite_diario: config?.limite_diario_gasolina || 2000,
      hoy: {
        fecha: hoy,
        agendados: limitesHoy?.litros_agendados || 0,
        procesados: limitesHoy?.litros_procesados || 0
      },
      mañana: {
        fecha: fechaMañana,
        agendados: limitesMañana?.litros_agendados || 0,
        disponible: (config?.limite_diario_gasolina || 2000) - (limitesMañana?.litros_agendados || 0)
      }
    });

  } catch (error) {
    console.error('Error al obtener límites:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar límite diario (admin)
app.put('/api/sistema/limite-diario', authenticateToken, async (req, res) => {
  try {
    const { limite } = req.body;

    if (!limite || limite <= 0) {
      return res.status(400).json({ error: 'Límite debe ser mayor a cero' });
    }

    await db.run(
      'UPDATE sistema_config SET limite_diario_gasolina = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = 1',
      [limite]
    );

    res.json({
      success: true,
      limite,
      message: 'Límite diario actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error al actualizar límite:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint de prueba para verificar conectividad
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Servidor funciona correctamente',
    timestamp: new Date().toISOString(),
    endpoints_disponibles: [
      'GET /api/test',
      'GET /api/sistema/limites',
      'GET /api/agendamientos/dia/:fecha',
      'POST /api/agendamientos',
      'POST /api/admin/reset-litros',
      'POST /api/admin/migrar-litros-separados'
    ]
  });
});

// Endpoint temporal para migrar datos de clientes existentes
app.post('/api/admin/migrar-litros-separados', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Iniciando migración de litros separados...');

    // Obtener todos los clientes
    const clientes = await db.all('SELECT * FROM clientes WHERE activo = 1');
    let clientesMigrados = 0;

    for (const cliente of clientes) {
      // Si ya tiene campos separados, no migrar
      if (cliente.litros_mes_gasolina !== null || cliente.litros_mes_gasoil !== null) {
        console.log(`  ⏭️  Cliente ${cliente.nombre}: Ya tiene campos separados`);
        continue;
      }

      // Migrar: asignar todos los litros legacy a gasolina
      const litrosMes = cliente.litros_mes || 0;
      const litrosDisponibles = cliente.litros_disponibles || 0;

      await db.run(
        'UPDATE clientes SET litros_mes_gasolina = ?, litros_mes_gasoil = 0, litros_disponibles_gasolina = ?, litros_disponibles_gasoil = 0 WHERE id = ?',
        [litrosMes, litrosDisponibles, cliente.id]
      );

      clientesMigrados++;
      console.log(`  ✅ Cliente ${cliente.nombre}: Migrado → ${litrosMes}L gasolina, 0L gasoil`);
    }

    console.log(`🔄 Migración completada: ${clientesMigrados} clientes migrados`);
    res.json({
      success: true,
      message: `Migración completada: ${clientesMigrados} clientes migrados`,
      clientesMigrados
    });
  } catch (error) {
    console.error('❌ Error en migración:', error);
    res.status(500).json({ error: 'Error en la migración' });
  }
});

// Endpoint para obtener lista de endpoints disponibles
app.get('/api/endpoints', (req, res) => {
  res.json({
    message: 'Endpoints disponibles',
    endpoints: [
      'GET /api/test',
      'GET /api/sistema/limites',
      'GET /api/agendamientos/dia/:fecha',
      'POST /api/agendamientos',
      'POST /api/admin/reset-litros',
      'POST /api/admin/migrar-litros-separados'
    ]
  });
});

// Endpoint de prueba para agendamientos (SIN AUTENTICACIÓN)
app.post('/api/test-agendamiento', async (req, res) => {
  console.log('🧪 TEST: Petición de agendamiento recibida:', req.body);
  try {
    const { cliente_id, tipo_combustible, litros } = req.body;

    // Validaciones básicas
    if (!cliente_id || !tipo_combustible || !litros) {
      console.log('❌ TEST: Faltan datos requeridos');
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Generar ticket de prueba
    const ticketPrueba = Math.floor(Math.random() * 200) + 1;

    console.log(`✅ TEST: Ticket generado: ${ticketPrueba}`);

    // Calcular fecha del día siguiente para la prueba
    const mañanaPrueba = new Date();
    mañanaPrueba.setDate(mañanaPrueba.getDate() + 1);
    const fechaAgendadaPrueba = mañanaPrueba.toISOString().split('T')[0];

    console.log(`📅 TEST: Fecha de hoy: ${new Date().toISOString().split('T')[0]}`);
    console.log(`📅 TEST: Fecha de retiro (mañana): ${fechaAgendadaPrueba}`);

    res.status(201).json({
      id: 999,
      cliente_id,
      tipo_combustible,
      litros,
      fecha_agendada: fechaAgendadaPrueba,
      codigo_ticket: ticketPrueba,
      message: 'TEST: Agendamiento de prueba creado exitosamente'
    });

  } catch (error) {
    console.error('❌ TEST: Error:', error);
    res.status(500).json({ error: 'Error en prueba' });
  }
});

// Agregar inventario para pruebas (TEMPORAL)
app.post('/api/admin/add-inventario', async (req, res) => {
  try {
    const { tipo_combustible = 'gasolina', litros = 5000 } = req.body;

    // Obtener inventario actual
    const inventarioActual = await db.get(
      'SELECT litros_disponibles FROM inventario WHERE tipo_combustible = ? ORDER BY id DESC LIMIT 1',
      [tipo_combustible]
    );

    const nuevosLitros = (inventarioActual?.litros_disponibles || 0) + litros;

    // Agregar inventario
    await db.run(
      'INSERT INTO inventario (tipo_combustible, litros_ingresados, litros_disponibles, usuario_id, observaciones) VALUES (?, ?, ?, ?, ?)',
      [tipo_combustible, litros, nuevosLitros, 1, 'Inventario para pruebas']
    );

    res.json({
      success: true,
      message: `${litros}L de ${tipo_combustible} agregados al inventario`,
      total_disponible: nuevosLitros
    });

  } catch (error) {
    console.error('Error al agregar inventario:', error);
    res.status(500).json({ error: 'Error al agregar inventario' });
  }
});

// Reset de litros disponibles para pruebas (TEMPORAL)
app.post('/api/admin/reset-litros', authenticateToken, async (req, res) => {
  try {
    // Resetear litros disponibles = litros mensuales para todos los clientes
    const result = await db.run(
      'UPDATE clientes SET litros_disponibles = litros_mes WHERE activo = 1'
    );

    // Obtener información de los clientes actualizados
    const clientes = await db.all(
      'SELECT id, nombre, cedula, litros_mes, litros_disponibles FROM clientes WHERE activo = 1'
    );

    console.log(`✅ Reset de litros completado para ${result.changes} clientes`);

    res.json({
      success: true,
      message: `Litros disponibles reseteados para ${result.changes} clientes`,
      clientes_actualizados: clientes.length,
      clientes: clientes
    });

  } catch (error) {
    console.error('Error al resetear litros:', error);
    res.status(500).json({ error: 'Error al resetear litros disponibles' });
  }
});

// Marcar agendamiento como entregado
app.patch('/api/agendamientos/:id/entregar', async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener el agendamiento
    const agendamiento = await db.get(
      'SELECT * FROM agendamientos WHERE id = ?',
      [id]
    );

    if (!agendamiento) {
      return res.status(404).json({ error: 'Agendamiento no encontrado' });
    }

    if (agendamiento.estado !== 'pendiente') {
      return res.status(400).json({ error: 'El agendamiento ya fue procesado' });
    }

    // Marcar como entregado
    await db.run(
      'UPDATE agendamientos SET estado = "entregado", fecha_procesado = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    console.log(`✅ Agendamiento ${id} marcado como entregado - Ticket: ${agendamiento.codigo_ticket}`);

    res.json({
      success: true,
      message: 'Agendamiento marcado como entregado',
      ticket: agendamiento.codigo_ticket
    });

  } catch (error) {
    console.error('Error al marcar agendamiento como entregado:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== FIN ENDPOINTS AGENDAMIENTOS ====================

// Configurar cron jobs para ejecutar tareas automáticas
function iniciarTareasAutomaticas() {
  // Recarga diaria de litros a las 00:00 (medianoche)
  cron.schedule('0 0 * * *', async () => {
    console.log('⏰ Ejecutando recarga automática diaria programada...');
    await recargarLitrosDiarios();
  });

  // Procesamiento de agendamientos a las 05:00 (5 AM)
  cron.schedule('0 5 * * *', async () => {
    console.log('⏰ Ejecutando procesamiento automático de agendamientos...');
    await procesarAgendamientosDelDia();
  });

  console.log('✅ Sistema de recarga automática diaria activado (00:00 cada día)');
  console.log('✅ Sistema de procesamiento automático de agendamientos activado (05:00 cada día)');

  // Opcional: Ejecutar inmediatamente al iniciar el servidor (para pruebas)
  // Descomentar las siguientes líneas si quieres que se ejecuten al iniciar
  // recargarLitrosDiarios();
  // procesarAgendamientosDelDia();
}

// Iniciar servidor
async function startServer() {
  try {
    await initDB();

    // Iniciar tareas automáticas
    await iniciarTareasAutomaticas();

    app.listen(PORT, () => {
      console.log(`Servidor Node.js ejecutándose en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
