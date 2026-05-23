# Backend Node.js + Express + MySQL — Docker puro (sin docker-compose)

## Estructura actual del proyecto

```
TP1-Docker-main/
├── Dockerfile
├── package.json
├── index.js
└── README.md
```

---

## Conceptos Docker aplicados

| Concepto | Dónde aparece |
|---|---|
| **Imagen Docker** | `FROM node:20-alpine` — imagen base oficial |
| **Puerto** | `EXPOSE 3000` en Dockerfile + `-p 3000:3000` en docker run |
| **Red Docker** | `docker network create` + `--network` en ambos contenedores |
| **Volumen de datos** | `-v mysql-data:/var/lib/mysql` — persiste los datos de MySQL |
| **Ruta del host (opcional, desarrollo)** | `-v "$(pwd)/index.js:/app/index.js"` — monta el código local en el contenedor |
| **Variables de entorno** | `-e DB_HOST=...` — credenciales sin hardcodear |

---

## Paso a paso: Levantar todo con `docker run`

### 1. Crear la red Docker compartida

```bash
docker network create mi-red-backend
```

> Ambos contenedores estarán en esta red y podrán comunicarse
> usando el **nombre del contenedor** como hostname.

---

### 2. Levantar MySQL

```bash
docker run -d --name mysql-db --network mi-red-backend \
  -e MYSQL_ROOT_PASSWORD=alumnoipm \
  -e MYSQL_DATABASE=appdb \
  -e MYSQL_USER=appuser \
  -e MYSQL_PASSWORD=apppass \
  -v mysql-data:/var/lib/mysql \
  -p 3307:3306 mysql:8.0
```

**Explicación de cada flag:**

| Flag | Qué hace |
|---|---|
| `-d` | Corre en segundo plano (detached) |
| `--name mysql-db` | Nombre del contenedor; el backend lo usará como hostname |
| `--network mi-red-backend` | Lo conecta a la red que creamos |
| `-e MYSQL_ROOT_PASSWORD` | Variable de entorno: contraseña de root |
| `-e MYSQL_DATABASE` | Crea esta base de datos al iniciar |
| `-v mysql-data:/var/lib/mysql` | **Volumen con nombre**: persiste datos aunque se borre el contenedor |
| `-p 3306:3306` | `PUERTO_HOST:PUERTO_CONTENEDOR` — expone MySQL a tu máquina |

---

### 3. Construir la imagen del backend

Desde la carpeta donde está el `Dockerfile`:

```bash
docker build -t backend-node .
```

---

### 4. Levantar el backend

```bash
docker run -d --name backend-api --network mi-red-backend \
  -e DB_HOST=mysql-db \
  -e DB_PORT=3306 \
  -e DB_USER=appuser \
  -e DB_PASSWORD=apppass \
  -e DB_NAME=appdb \
  -e PORT=3000 \
  -p 3000:3000 backend-node
```

Este comando es ideal para la demo porque ejecuta exactamente la imagen construida.

Si querés modo desarrollo (reflejar cambios locales sin rebuild), podés montar solo `index.js`:

```bash
docker run -d --name backend-api --network mi-red-backend \
  -e DB_HOST=mysql-db -e DB_PORT=3306 -e DB_USER=appuser -e DB_PASSWORD=apppass -e DB_NAME=appdb -e PORT=3000 \
  -v "$(pwd)/index.js:/app/index.js" \
  -p 3000:3000 backend-node
```

**Explicación de cada flag:**

| Flag | Qué hace |
|---|---|
| `--network mi-red-backend` | Misma red que MySQL → pueden verse entre sí |
| `-e DB_HOST=mysql-db` | El hostname de MySQL ES el nombre del contenedor |
| `-e DB_USER / DB_PASSWORD` | Credenciales sin hardcodear en el código |
| `-v $(pwd)/src:/app/src` | **Ruta del host** montada en el contenedor (útil en desarrollo: cambios en tu PC se reflejan sin rebuild) |
| `-p 3000:3000` | `PUERTO_HOST:PUERTO_CONTENEDOR` — accedés desde `localhost:3000` |

> **Nota:** En Linux/macOS, `$(pwd)` funciona en bash.  
> En Windows PowerShell usá `${PWD}`.

---

## Endpoints disponibles

### `GET /health`
Verifica que la API esté activa. No toca la base de datos.

```bash
curl http://localhost:3000/health
```
```json
{
  "status": "ok",
  "message": "API activa",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

---

### `GET /db-status`
Ejecuta `SELECT NOW()` en MySQL y devuelve el resultado.

```bash
curl http://localhost:3000/db-status
```
```json
{
  "status": "ok",
  "db_connected": true,
  "db_time": "2024-01-15T12:00:00.000Z",
  "host": "mysql-db",
  "database": "appdb"
}
```

---

### `POST /items`
Inserta un item en la tabla.

```bash
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Mi primer item"}'
```
```json
{
  "status": "ok",
  "item": { "id": 1, "nombre": "Mi primer item", "created_at": "2024-01-15T12:00:00.000Z" }
}
```

---

### `GET /items`
Lista todos los items.

```bash
curl http://localhost:3000/items
```
```json
{
  "status": "ok",
  "count": 1,
  "items": [{ "id": 1, "nombre": "Mi primer item", "created_at": "..." }]
}
```

---

## Comandos útiles de administración

```bash
# Ver logs del backend
docker logs -f backend-api

# Ver logs de MySQL
docker logs -f mysql-db

# Listar contenedores corriendo
docker ps

# Ver redes Docker
docker network ls

# Inspeccionar la red (ver qué contenedores están conectados)
docker network inspect mi-red-backend

# Ver volúmenes
docker volume ls

# Entrar al contenedor del backend
docker exec -it backend-api sh

# Entrar a MySQL desde el contenedor
docker exec -it mysql-db mysql -u appuser -papppass appdb

# Detener y eliminar todo
docker stop backend-api mysql-db
docker rm backend-api mysql-db
docker network rm mi-red-backend
# (el volumen se mantiene intencionalmente para no perder datos)
# para borrarlo también:
docker volume rm mysql-data
```

---

## Diagrama de la arquitectura

```
Tu máquina (host)
│
├── localhost:3000 ──────────────────────────────────────────────┐
│                                                                 │
│   RED DOCKER: mi-red-backend                                    │
│   ┌─────────────────────────┐   ┌──────────────────────────┐   │
│   │  Contenedor: backend-api│   │  Contenedor: mysql-db    │   │
│   │  Imagen: backend-node   │   │  Imagen: mysql:8.0       │   │
│   │  Puerto interno: 3000   │◄──│  Puerto interno: 3306    │   │
│   │  Puerto host:    3000   │   │  Puerto host:    3306    │   │
│   │                         │   │                          │   │
│   │  Vol (opcional):        │   │  Vol: mysql-data         │   │
│   │  $(pwd)/index.js        │   │                          │   │
│   │       ↕                 │   │       ↕                  │   │
│   │  /app/index.js          │   │  /var/lib/mysql          │   │
│   └─────────────────────────┘   └──────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
