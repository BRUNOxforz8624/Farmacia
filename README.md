# FarmApp - Comparador de Precios para Farmacia

Aplicacion para comparar precios de medicamentos entre diferentes proveedores.

## Caracteristicas

- Carga de datos desde PDF, Excel y paginas web
- Filtro automatico por:
  - Cantidad minima (5 unidades)
  - Vida util minima (6 meses)
- Comparacion de precios entre proveedores
- Dashboard con mejores ofertas

## Requisitos

- Python 3.9+
- PostgreSQL 12+
- pip

## Instalacion

### 1. Clonar el repositorio

```bash
cd farmacia
```

### 2. Crear entorno virtual

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
```

### 3. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 4. Configurar base de datos

```bash
# Crear base de datos en PostgreSQL
psql -U postgres -c "CREATE DATABASE farmacia_db;"
psql -U postgres -d farmacia_db -f ../database/migrations/init.sql
```

### 5. Configurar variables de entorno (opcional)

```bash
set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/farmacia_db
```

### 6. Ejecutar la aplicacion

```bash
python app.py
```

La aplicacion estara disponible en: http://localhost:5000

## Uso

### Cargar datos

1. Ir a "Cargar Datos"
2. Seleccionar tipo de archivo (PDF, Excel o Web)
3. Arrastrar archivo o ingresar URL
4. Los datos se procesaran automaticamente

### Comparar precios

1. Ir a "Comparar Precios"
2. Opcionalmente buscar un producto especifico
3. Ajustar filtros de cantidad y vida util
4. Los resultados muestran solo ofertas validas

### Formato esperado de archivos

Los archivos deben tener columnas como:

| Producto | Precio | Cantidad | Vencimiento | Proveedor |
|----------|--------|----------|-------------|-----------|
| Paracetamol | 15.50 | 100 | 2025-12-31 | Farmacia A |
| Ibuprofeno | 22.00 | 50 | 2025-06-15 | Farmacia B |

## Estructura

```
farmacia/
├── backend/
│   ├── app.py              # Servidor Flask
│   ├── config.py           # Configuracion
│   ├── models.py           # Modelos de base de datos
│   ├── routes/             # Endpoints API
│   └── services/           # Logica de negocio
├── frontend/
│   ├── index.html          # Interfaz principal
│   ├── css/                # Estilos
│   └── js/                 # JavaScript
└── database/
    └── migrations/         # SQL de base de datos
```

## API Endpoints

- `GET /api/products/` - Listar productos
- `POST /api/upload/pdf` - Subir PDF
- `POST /api/upload/excel` - Subir Excel
- `POST /api/upload/web` - Scrapear URL
- `GET /api/compare/best` - Mejores precios
- `GET /api/compare/product?q=nombre` - Comparar producto
