import sqlite3

conn = sqlite3.connect('gas_delivery.db')
cursor = conn.cursor()

try:
    cursor.execute("SELECT id, usuario, contrasena, es_admin FROM usuarios")
    users = cursor.fetchall()
    print("Users found:")
    for user in users:
        print(user)
except Exception as e:
    print(f"Error: {e}")

conn.close()
