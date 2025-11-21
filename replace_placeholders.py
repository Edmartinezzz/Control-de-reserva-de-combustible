import re

# Leer el archivo
with open('server.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Reemplazar ? por %s en consultas SQL (no en strings)
# Solo reemplazar ? que están fuera de comillas simples
content_modified = content.replace("= ?'", "= %s'")
content_modified = content_modified.replace("= ?)", "= %s)")
content_modified = content_modified.replace("= ?,", "= %s,")
content_modified = content_modified.replace("(?,", "(%s,")
content_modified = content_modified.replace(", ?)", ", %s)")
content_modified = content_modified.replace(", ?,", ", %s,")
content_modified = content_modified.replace("(?)", "(%s)")
content_modified = content_modified.replace("(?, ", "(%s, ")
content_modified = content_modified.replace("VALUES (?", "VALUES (%s")

# Guardar el archivo
with open('server.py', 'w', encoding='utf-8') as f:
    f.write(content_modified)

print("✅ Placeholders reemplazados correctamente")
