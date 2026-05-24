FROM node:20-alpine

# Directorio de trabajo DENTRO del contenedor 
WORKDIR /app #Todo lo que copiemos o ejecutemos irá aquí

# Copiar manifiestos de dependencias primero
# Esto aprovecha la caché de Docker: si package.json no cambia, Docker reutiliza la capa de npm install en builds futuros.
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --omit=dev

# Copiar el código fuente al contenedor
COPY index.js ./

# Puerto que el proceso escuchará dentro del contenedor
# es documentación, el mapeo real se hace con -p en docker run.
EXPOSE 3000

# Variables de entorno con valores por defecto (override en docker run)
ENV PORT=3000 \
    DB_HOST=mysql-db \
    DB_PORT=3306 \
    DB_USER=root \
    DB_PASSWORD=alumnoipm \
    DB_NAME=appdb

# Comando de arranque del contenedor
CMD ["node", "index.js"]
