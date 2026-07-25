-- Crear base de datos
CREATE DATABASE farmacia_db;

-- Conectar a la base de datos
\c farmacia_db;

-- Tabla de proveedores
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    contact VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    category VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de historial de cargas
CREATE TABLE uploads (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255),
    file_type VARCHAR(50),
    status VARCHAR(50),
    records_imported INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de precios
CREATE TABLE prices (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    expiration_date DATE,
    upload_id INTEGER REFERENCES uploads(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices para busquedas rapidas
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_prices_product ON prices(product_id);
CREATE INDEX idx_prices_supplier ON prices(supplier_id);
CREATE INDEX idx_prices_expiration ON prices(expiration_date);
