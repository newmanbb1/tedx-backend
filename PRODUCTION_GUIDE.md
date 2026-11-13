# 🚀 Guía Oficial de Despliegue en Producción - TEDx USFX 2026

Plataforma oficial de venta de entradas, validación bancaria, acreditación con QR, emisión de certificados y automatización WhatsApp para **TEDx USFX 2026**.

---

## 📋 1. Requisitos Mínimos del Servidor (VPS)

- **Sistema Operativo:** Ubuntu 22.04 LTS / 24.04 LTS o Debian 12
- **CPU:** 2 vCPU o superior
- **Memoria RAM:** 4 GB de RAM (o 2 GB con 2 GB de SWAP activado)
- **Disco:** 25 GB SSD / NVMe
- **Puertos de Red Abiertos:**
  - `80` (HTTP)
  - `443` (HTTPS)
  - `22` (SSH)

---

## 🐳 2. Método Recomendado: Despliegue con Docker Compose

El despliegue con contenedores garantiza que todas las dependencias (PostgreSQL 16, Node.js 20, Evolution API y Nginx) funcionen de forma aislada y reproducible en cualquier servidor.

### Paso 2.1: Instalar Docker y Docker Compose en el Servidor
```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Docker con el script oficial
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Añadir tu usuario al grupo docker
sudo usermod -aG docker $USER
newgrp docker

# Verificar instalación
docker --version
docker compose version
```

### Paso 2.2: Clonar el Repositorio y Configurar Variables de Entorno
```bash
# Clonar el proyecto
git clone git@github.com:newmanbb1/tedx-project.git
cd tedx-project

# Generar archivo de configuración productivo a partir de la plantilla
cp .env.prod.example .env
```

Edita `.env` con tus credenciales reales:
```bash
nano .env
```
> [!IMPORTANT]
> **Generación de JWT_SECRET:**
> Ejecuta en tu terminal `openssl rand -hex 32` y pega el resultado en la variable `JWT_SECRET`.
> Configura `CLIENT_URL="https://tudominio.com"` para permitir peticiones seguras de tu frontend.

### Paso 2.3: Ejecutar el Despliegue Automatizado
Ejecuta el script de despliegue incluido:
```bash
./deploy.sh
```
El script compilará el código de backend y frontend, levantará los contenedores en segundo plano, ejecutará las migraciones de Prisma y comprobará el estado de salud de la API.

---

## 🔒 3. Configuración de Dominio y Certificado SSL (HTTPS) con Let's Encrypt

Para habilitar HTTPS en tu dominio (ejemplo: `tedxusfx.com`):

### Opción A: Usando Certbot con Nginx Host como Proxy Inverso
Si tienes Nginx instalado en el host del VPS:
```bash
# 1. Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. Configurar el bloque de servidor en /etc/nginx/sites-available/tedxusfx.com
sudo nano /etc/nginx/sites-available/tedxusfx.com
```

Contenido recomendado para `/etc/nginx/sites-available/tedxusfx.com`:
```nginx
server {
    server_name tedxusfx.com www.tedxusfx.com;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 3. Habilitar sitio y solicitar certificado SSL
sudo ln -s /etc/nginx/sites-available/tedxusfx.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. Obtener certificado SSL automáticamente
sudo certbot --nginx -d tedxusfx.com -d www.tedxusfx.com
```

---

## 🛠️ 4. Método Alternativo: Despliegue Manual con PM2 + Nginx + PostgreSQL Nativo

Si prefieres no usar Docker, puedes ejecutar los servicios directamente en el sistema operativo:

### 4.1 Instalar Dependencias del Host
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib

# Instalar pnpm y PM2 globalmente
sudo npm install -g pnpm pm2
```

### 4.2 Configurar Base de Datos PostgreSQL
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE tedx_ticketing;
CREATE USER tedx_user WITH ENCRYPTED PASSWORD 'TuPasswordSeguro2026!';
GRANT ALL PRIVILEGES ON DATABASE tedx_ticketing TO tedx_user;
\q
```

### 4.3 Compilar y Levantar el Backend con PM2
```bash
cd tedx-backend
cp .env.production.example .env
nano .env # Ajusta DATABASE_URL, JWT_SECRET, etc.

# Instalar y compilar
pnpm install --frozen-lockfile
pnpm run prisma:generate
pnpm run prisma:migrate
pnpm run build

# Iniciar proceso con PM2
pm2 start dist/index.js --name "tedx-backend" --time
pm2 save
pm2 startup
```

### 4.4 Compilar el Frontend y Servir con Nginx
```bash
cd ../tedx-frontend
pnpm install --frozen-lockfile
pnpm run build

# Copiar la carpeta compilada (dist/) al directorio web de Nginx
sudo mkdir -p /var/www/tedx-frontend
sudo cp -r dist/* /var/www/tedx-frontend/
```

Configuración Nginx para `/etc/nginx/sites-available/tedx`:
```nginx
server {
    listen 80;
    server_name tedxusfx.com www.tedxusfx.com;
    root /var/www/tedx-frontend;
    index index.html;

    client_max_body_size 20M;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 📱 5. Conexión de WhatsApp Oficial (Evolution API)

1. Ingresa al **Panel de Administración** (`/admin`) con la cuenta de Director.
2. Dirígete a la pestaña **«WhatsApp API (Evolution)»**.
3. El sistema verificará la instancia `tedxusfx2026`.
4. Elige entre dos métodos:
   - **Código QR:** Escanea el código en pantalla desde WhatsApp (`Dispositivos vinculados > Vincular un dispositivo`).
   - **Código de Emparejamiento por Número (Pairing Code):** Ingresa tu número de teléfono boliviano (+591...) y digita en WhatsApp el código numérico de 8 caracteres.
5. Realiza un envío de prueba al finalizar para confirmar que el estado esté en **Conectado (OPEN)**.

---

## 💾 6. Respaldo Automático de Base de Datos (Backups Diarios)

Crea un script de respaldo automático con cron para proteger la información de compradores y pagos:

```bash
sudo nano /usr/local/bin/backup-tedx-db.sh
```

Contenido del script:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/tedx-db"
mkdir -p $BACKUP_DIR
FECHA=$(date +"%Y%m%d_%H%M%S")

# Si usas Docker Compose:
docker compose -f /path/to/tedx-project/docker-compose.prod.yml exec -T postgres pg_dump -U tedx_prod_user tedx_prod | gzip > "$BACKUP_DIR/tedx_backup_$FECHA.sql.gz"

# Mantener solo los últimos 14 respaldos
find $BACKUP_DIR -name "*.sql.gz" -mtime +14 -delete
```

Hazlo ejecutable y añade una tarea cron diaria:
```bash
sudo chmod +x /usr/local/bin/backup-tedx-db.sh
sudo crontab -e
# Agregar al final para ejecutar todos los días a las 03:00 AM:
0 3 * * * /usr/local/bin/backup-tedx-db.sh
```

---

## 🛡️ 7. Auditoría y Lista de Verificación Previa al Lanzamiento

- [ ] **JWT_SECRET:** Cambiado por una clave única y aleatoria (`openssl rand -hex 32`).
- [ ] **Contraseña de Administrador:** Cambiar la clave por defecto de `admin@tedx.local` desde el nuevo panel de **Gestión de Usuarios**.
- [ ] **QR de Pago Oficial:** Subido en la sección de **Configuración Pago QR** con los datos del titular y banco de Sucre/Bolivia.
- [ ] **Cuentas de Equipo:** Crear los usuarios necesarios para Validadores de finanzas, Voluntarios de mesa y Staff de puerta (Check-in).
- [ ] **Certificado SSL:** HTTPS activo con redirección obligatoria desde HTTP (candado verde en el navegador).
- [ ] **Health Check:** Verificar `curl -I https://tudominio.com/api/health` devolviendo `HTTP 200 OK`.
