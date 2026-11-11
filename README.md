# TEDx Innova - Backend API

API RESTful desarrollada en **Node.js + Express + TypeScript** con **Prisma ORM** y **PostgreSQL** para la plataforma de venta de entradas y control de acceso del evento TEDx Innova.

---

## 🛠️ Tecnologías

- **Node.js & Express**: Framework web backend con TypeScript.
- **Prisma ORM**: Modelado de datos y migraciones para PostgreSQL.
- **JWT & bcryptjs**: Autenticación segura y control de roles (`ADMIN`, `STAFF`).
- **Multer**: Almacenamiento local de comprobantes de transferencia bancaria.
- **QRCode**: Generación de códigos QR únicos para boletos de acceso.
- **Nodemailer**: Envío de boletos y confirmaciones por correo electrónico.
- **Zod**: Validación de esquemas y payloads de entrada.

---

## 🚀 Instalación y Puesta en Marcha

### 1. Requisitos
- Node.js >= 18
- Docker & Docker Compose (para PostgreSQL local)

### 2. Base de Datos
Levanta PostgreSQL:
```bash
docker compose up -d
```

### 3. Configuración de Variables de Entorno
Copia el archivo de ejemplo:
```bash
cp .env.example .env
```
Ajusta `DATABASE_URL` y `JWT_SECRET` si es necesario.

### 4. Dependencias y Base de Datos
```bash
npm install
npm run prisma:push
npm run prisma:seed
```

### 5. Iniciar Servidor en Desarrollo
```bash
npm run dev
```
El servidor correrá en `http://localhost:4000`.

---

## 🔑 Credenciales por Defecto (Seed)

- **Administrador**: `admin@tedx.local` / `AdminTedx2026!`
- **Staff Puerta**: `staff@tedx.local` / `StaffTedx2026!`
