/**
 * Database Configuration
 * Supports both SQLite (development) and PostgreSQL (production)
 */

const { Pool } = require('pg');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const isProduction = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

let db;

/**
 * Initialize database connection
 */
async function initDatabase() {
    if (isProduction && DATABASE_URL) {
        console.log('🐘 Conectando a PostgreSQL...');

        // PostgreSQL connection
        const pool = new Pool({
            connectionString: DATABASE_URL,
            ssl: {
                rejectUnauthorized: false // Necesario para Render
            }
        });

        // Test connection
        try {
            const client = await pool.connect();
            console.log('✅ Conectado a PostgreSQL exitosamente');
            client.release();
        } catch (error) {
            console.error('❌ Error conectando a PostgreSQL:', error);
            throw error;
        }

        db = {
            pool,
            isPostgres: true,

            // Wrapper methods to maintain compatibility
            async get(query, params = []) {
                const result = await pool.query(convertQuery(query), params);
                return result.rows[0];
            },

            async all(query, params = []) {
                const result = await pool.query(convertQuery(query), params);
                return result.rows;
            },

            async run(query, params = []) {
                const result = await pool.query(convertQuery(query), params);
                return {
                    lastID: result.rows[0]?.id,
                    changes: result.rowCount
                };
            },

            async exec(query) {
                await pool.query(query);
            }
        };

    } else {
        console.log('📁 Usando SQLite (desarrollo)...');

        // SQLite connection
        db = await open({
            filename: './gas_delivery.db',
            driver: sqlite3.Database
        });

        db.isPostgres = false;
        console.log('✅ Conectado a SQLite exitosamente');
    }

    return db;
}

/**
 * Convert SQLite queries to PostgreSQL
 */
function convertQuery(query) {
    if (!db.isPostgres) return query;

    let converted = query;

    // Convert ? placeholders to $1, $2, etc.
    let paramIndex = 1;
    converted = converted.replace(/\?/g, () => `$${paramIndex++}`);

    // Convert AUTOINCREMENT to SERIAL (handled in schema)
    converted = converted.replace(/AUTOINCREMENT/gi, '');

    // Convert SQLite date functions to PostgreSQL
    converted = converted.replace(/date\('now'\)/gi, "CURRENT_DATE");
    converted = converted.replace(/datetime\('now'\)/gi, "CURRENT_TIMESTAMP");
    converted = converted.replace(/strftime\('%Y-%m', fecha\)/gi, "TO_CHAR(fecha, 'YYYY-MM')");
    converted = converted.replace(/strftime\('%Y', fecha\)/gi, "TO_CHAR(fecha, 'YYYY')");
    converted = converted.replace(/DATE\(fecha\)/gi, "fecha::date");

    // Convert CURRENT_TIMESTAMP
    converted = converted.replace(/CURRENT_TIMESTAMP/g, "NOW()");

    return converted;
}

/**
 * Get database instance
 */
function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

module.exports = {
    initDatabase,
    getDatabase,
    convertQuery
};
