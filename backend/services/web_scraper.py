import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
import re
from datetime import datetime

def scrape_url(url: str) -> List[Dict]:
    """
    Extrae productos de una pagina web.
    Busca tablas con precios de medicamentos.
    """
    products = []
    
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Buscar tablas
        tables = soup.find_all('table')
        
        for table in tables:
            table_products = process_table(table)
            products.extend(table_products)
        
        # Si no hay tablas, buscar listados de productos
        if not products:
            products = process_product_listings(soup)
        
    except requests.RequestException as e:
        raise Exception(f"Error accediendo a la URL: {str(e)}")
    
    return products

def process_table(table) -> List[Dict]:
    """Procesa una tabla HTML"""
    products = []
    
    rows = table.find_all('tr')
    if len(rows) < 2:
        return products
    
    # Obtener headers
    header_row = rows[0]
    headers = [th.get_text(strip=True).lower() for th in header_row.find_all(['th', 'td'])]
    col_map = map_columns(headers)
    
    # Procesar filas de datos
    for row in rows[1:]:
        cells = [td.get_text(strip=True) for td in row.find_all('td')]
        
        if not cells or all(not cell for cell in cells):
            continue
        
        product = extract_product_data(cells, col_map)
        if product:
            products.append(product)
    
    return products

def process_product_listings(soup) -> List[Dict]:
    """Busca listados de productos en la pagina"""
    products = []
    
    # Buscar divs con clase comun de producto
    product_selectors = [
        '.product', '.item', '.card', '.medicine',
        '[class*="product"]', '[class*="item"]', '[class*="medicamento"]'
    ]
    
    for selector in product_selectors:
        elements = soup.select(selector)
        
        for element in elements:
            product = extract_from_element(element)
            if product:
                products.append(product)
    
    return products

def extract_from_element(element) -> Optional[Dict]:
    """Extrae datos de un elemento HTML"""
    try:
        # Buscar nombre
        name_el = element.find(['h2', 'h3', 'h4', 'a', '.name', '.title', '.nombre'])
        name = name_el.get_text(strip=True) if name_el else None
        
        # Buscar precio
        price_el = element.find(['span', 'div', '.price', '.precio', '.cost'])
        price = None
        if price_el:
            price_text = price_el.get_text(strip=True)
            price = parse_number(price_text)
        
        if not name or price is None:
            return None
        
        # Buscar cantidad
        qty_el = element.find(['span', 'div', '.quantity', '.cantidad', '.stock'])
        quantity = None
        if qty_el:
            qty_text = qty_el.get_text(strip=True)
            quantity = parse_integer(qty_text)
        
        # Buscar fecha de vencimiento
        exp_el = element.find(['span', 'div', '.expiration', '.vencimiento', '.expiry'])
        expiration = None
        if exp_el:
            exp_text = exp_el.get_text(strip=True)
            expiration = parse_date(exp_text)
        
        return {
            'name': name,
            'price': price,
            'quantity': quantity or 0,
            'expiration_date': expiration,
            'supplier': None
        }
    except Exception:
        return None

def map_columns(headers: List[str]) -> Dict[str, int]:
    """Mapea nombres de columnas a sus indices"""
    col_map = {}
    
    name_keywords = ['producto', 'nombre', 'articulo', 'medicamento', 'descripcion', 'name', 'description', 'item']
    price_keywords = ['precio', 'price', 'costo', 'cost', 'importe']
    qty_keywords = ['cantidad', 'quantity', 'stock', 'unidades', 'units']
    exp_keywords = ['vencimiento', 'expiration', 'exp', 'fecha', 'date', 'caducidad']
    supplier_keywords = ['proveedor', 'supplier', 'distribuidor', 'farmacia']
    
    for i, header in enumerate(headers):
        if not header:
            continue
        
        header_lower = header.lower()
        
        for kw in name_keywords:
            if kw in header_lower:
                col_map['name'] = i
                break
        
        for kw in price_keywords:
            if kw in header_lower:
                col_map['price'] = i
                break
        
        for kw in qty_keywords:
            if kw in header_lower:
                col_map['quantity'] = i
                break
        
        for kw in exp_keywords:
            if kw in header_lower:
                col_map['expiration'] = i
                break
        
        for kw in supplier_keywords:
            if kw in header_lower:
                col_map['supplier'] = i
                break
    
    return col_map

def extract_product_data(cells: List[str], col_map: Dict) -> Optional[Dict]:
    """Extrae datos de una fila"""
    try:
        name = None
        price = None
        quantity = None
        expiration = None
        supplier = None
        
        if 'name' in col_map and col_map['name'] < len(cells):
            name = clean_text(cells[col_map['name']])
        
        if 'price' in col_map and col_map['price'] < len(cells):
            price = parse_number(cells[col_map['price']])
        
        if 'quantity' in col_map and col_map['quantity'] < len(cells):
            quantity = parse_integer(cells[col_map['quantity']])
        
        if 'expiration' in col_map and col_map['expiration'] < len(cells):
            expiration = parse_date(cells[col_map['expiration']])
        
        if 'supplier' in col_map and col_map['supplier'] < len(cells):
            supplier = clean_text(cells[col_map['supplier']])
        
        if not name or price is None:
            return None
        
        return {
            'name': name,
            'price': price,
            'quantity': quantity or 0,
            'expiration_date': expiration,
            'supplier': supplier
        }
    except Exception:
        return None

def clean_text(text) -> str:
    """Limpia texto"""
    if not text:
        return ''
    text = str(text).strip()
    text = re.sub(r'\s+', ' ', text)
    return text

def parse_number(value) -> Optional[float]:
    """Parsea un numero"""
    if not value:
        return None
    
    try:
        text = str(value).strip()
        text = re.sub(r'[^\d.,-]', '', text)
        text = text.replace(',', '').replace(' ', '')
        if text:
            return float(text)
    except:
        pass
    return None

def parse_integer(value) -> Optional[int]:
    """Parsea un entero"""
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
    """Parsea una fecha"""
    if not value:
        return None
    
    date_formats = [
        '%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d', '%Y/%m/%d',
        '%d/%m/%y', '%d-%m-%y', '%m/%d/%Y', '%m-%d-%Y'
    ]
    
    text = str(value).strip()
    
    for fmt in date_formats:
        try:
            return datetime.strptime(text, fmt).date()
        except:
            continue
    
    return None
