import sqlite3

conn = sqlite3.connect('gas_delivery.db')
cursor = conn.cursor()

try:
    # Reset password to 'admin123' (plain text as expected by current server.py)
    cursor.execute("UPDATE usuarios SET contrasena = ? WHERE usuario = ?", ('admin123', 'admin'))
    conn.commit()
    print("Password updated successfully.")
except Exception as e:
    print(f"Error: {e}")

conn.close()
