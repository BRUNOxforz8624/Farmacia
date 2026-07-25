import pdfplumber
import re
from datetime import datetime
from typing import List, Dict, Optional

COLUMN_CONFIG = {
    'barcode': {
        'exact': ['cód. barra', 'cod barra', 'codigo de barras', 'cod barras', 'código de barras'],
        'contains': ['barras', 'barcode', 'ean']
    },
    'name': {
        'exact': ['descripción', 'descripcion', 'description', 'detalle'],
        'contains': ['descripcion', 'descripción', 'description', 'detalle', 'producto']
    },
    'expiration': {
        'exact': ['fecha venc.', 'fecha vencimiento', 'fec lote', 'fecha lote', 'vencimiento', 'fec. venc.'],
        'contains': ['venc', 'fec lote', 'lote']
    },
    'quantity': {
        'exact': ['existencia', 'inventario', 'cantidad solicitada', 'pedido', 'stock', 'disponible'],
        'contains': ['existencia', 'inventario', 'cantidad', 'pedido', 'stock']
    },
    'price': {
        'exact': ['precio (referencial)', 'precio promo (referencial)', 'precio uni', 'precio unit', 'precio unitario', 'precio externo ($) referencial', 'precio'],
        'contains': ['precio']
    },
    'supplier': {
        'exact': ['proveedor', 'laboratorio', 'lab', 'fabricante'],
        'contains': ['proveedor', 'laboratorio', 'lab', 'fabricante']
    },
    'conditions': {
        'exact': ['condición', 'condicion', 'acuerdo comercial', 'dcto. nena', 'dcto. ct', 'dcto. en factura', 'oferta', 'descuento'],
        'contains': ['condicion', 'condición', 'acuerdo', 'dcto', 'descuento', 'oferta']
    }
}

def parse_pdf(file_path: str) -> List[Dict]:
    products = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue
                headers = [str(h).strip() if h else '' for h in table[0]]
                col_map = map_columns(headers)
                if not col_map and len(table) > 2:
                    headers = [str(h).strip() if h else '' for h in table[1]]
                    col_map = map_columns(headers)
                    data_rows = table[2:]
                else:
                    data_rows = table[1:]
                if not col_map:
                    continue
                for row in data_rows:
                    if not row or all(cell is None for cell in row):
                        continue
                    product = extract_product_data(row, col_map)
                    if product:
                        products.append(product)
    return products

def map_columns(headers: List[str]) -> Dict[str, int]:
    col_map = {}
    headers_lower = [h.lower().strip() for h in headers]
    for field, config in COLUMN_CONFIG.items():
        for i, header in enumerate(headers_lower):
            if header in config['exact']:
                col_map[field] = i
                break
    for field, config in COLUMN_CONFIG.items():
        if field in col_map:
            continue
        for i, header in enumerate(headers_lower):
            if not header:
                continue
            for keyword in config['contains']:
                if keyword in header:
                    col_map[field] = i
                    break
            if field in col_map:
                break
    return col_map

def extract_product_data(row: List, col_map: Dict) -> Optional[Dict]:
    try:
        barcode = get_cell(row, col_map, 'barcode')
        name = get_cell(row, col_map, 'name')
        expiration = parse_date(get_cell(row, col_map, 'expiration'))
        quantity = parse_integer(get_cell(row, col_map, 'quantity'))
        price = parse_price(get_cell(row, col_map, 'price'))
        supplier = get_cell(row, col_map, 'supplier')
        conditions = get_cell(row, col_map, 'conditions')
        if not name or price is None:
            return None
        return {
            'barcode': barcode,
            'name': name,
            'expiration_date': expiration,
            'quantity': quantity or 0,
            'price': price,
            'supplier': supplier,
            'special_conditions': conditions
        }
    except Exception:
        return None

def get_cell(row: List, col_map: Dict, field: str) -> Optional[str]:
    if field in col_map and col_map[field] < len(row):
        value = row[col_map[field]]
        return clean_text(value)
    return None

def clean_text(text) -> str:
    if not text:
        return ''
    text = str(text).strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def parse_price(value) -> Optional[float]:
    if not value:
        return None
    try:
        text = str(value).strip()
        text = text.replace('$', '').replace(' ', '')
        if ',' in text and '.' in text:
            text = text.replace('.', '').replace(',', '.')
        elif ',' in text:
            text = text.replace(',', '.')
        text = re.sub(r'[^\d.]', '', text)
        if text:
            return float(text)
    except:
        pass
    return None

def parse_integer(value) -> Optional[int]:
    if not value:
        return None
    try:
        text = str(value).strip()
        text = re.sub(r'[^\d-]', '', text)
        if text:
            return int(float(text))
    except:
        pass
    return None

def parse_date(value) -> Optional[datetime]:
    if not value:
        return None
    date_formats = [
        '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%Y/%m/%d',
        '%d/%m/%y', '%d-%m-%y', '%m/%d/%Y', '%m-%d-%Y',
        '%d.%m.%Y', '%d.%m.%y', '%Y%m%d', '%m/%Y', '%m-%Y'
    ]
    text = str(value).strip()
    for fmt in date_formats:
        try:
            return datetime.strptime(text, fmt).date()
        except:
            continue
    return None
