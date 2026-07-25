from datetime import date, timedelta
from typing import List, Dict
from models import db, Price, Product, Supplier
from sqlalchemy import func

def is_valid_offer(price_record: Price, min_qty: int = 5, min_months: int = 6) -> bool:
    """
    Valida si una oferta cumple los requisitos:
    1. Mas de 5 unidades disponibles
    2. Mas de 6 meses de vida util
    """
    has_enough_stock = price_record.quantity > min_qty
    
    if price_record.expiration_date:
        today = date.today()
        months_remaining = (price_record.expiration_date - today).days / 30
        has_enough_shelf_life = months_remaining > min_months
    else:
        has_enough_shelf_life = True
    
    return has_enough_stock and has_enough_shelf_life

def get_best_prices(min_qty: int = 5, min_months: int = 6) -> List[Dict]:
    """
    Obtiene los mejores precios para cada producto que cumpla los requisitos.
    Retorna lista de productos con sus mejores ofertas.
    """
    # Subquery: precio minimo por producto que cumple filtros
    subquery = db.session.query(
        Price.product_id,
        func.min(Price.price).label('min_price')
    ).join(Product).filter(
        Price.quantity > min_qty
    )
    
    # Agregar filtro de fecha si aplica
    if min_months > 0:
        cutoff_date = date.today() + timedelta(days=min_months * 30)
        subquery = subquery.filter(
            (Price.expiration_date.is_(None)) | 
            (Price.expiration_date > cutoff_date)
        )
    
    subquery = subquery.group_by(Price.product_id).subquery()
    
    # Query principal: obtener ofertas con precio minimo
    results = db.session.query(
        Product,
        Supplier,
        Price
    ).join(
        subquery,
        (Price.product_id == subquery.c.product_id) & 
        (Price.price == subquery.c.min_price)
    ).join(
        Product, Price.product_id == Product.id
    ).join(
        Supplier, Price.supplier_id == Supplier.id
    ).all()
    
    best_prices = []
    seen_products = set()
    
    for product, supplier, price in results:
        if product.id not in seen_products:
            seen_products.add(product.id)
            
            months_left = None
            if price.expiration_date:
                months_left = (price.expiration_date - date.today()).days / 30
            
            best_prices.append({
                'product_id': product.id,
                'barcode': product.barcode,
                'product_name': product.name,
                'supplier_id': supplier.id,
                'supplier_name': supplier.name,
                'price': float(price.price),
                'quantity': price.quantity,
                'expiration_date': price.expiration_date.isoformat() if price.expiration_date else None,
                'months_until_expiration': round(months_left, 1) if months_left else None,
                'special_conditions': price.special_conditions,
                'is_valid': is_valid_offer(price, min_qty, min_months)
            })
    
    # Ordenar por precio
    best_prices.sort(key=lambda x: x['price'])
    
    return best_prices

def compare_product(product_name: str, min_qty: int = 5, min_months: int = 6) -> List[Dict]:
    """
    Compara precios de un producto especifico entre todos los proveedores.
    """
    # Buscar producto por nombre o codigo de barras
    products = Product.query.filter(
        db.or_(
            Product.name.ilike(f'%{product_name}%'),
            Product.barcode.ilike(f'%{product_name}%')
        )
    ).all()
    
    if not products:
        return []
    
    results = []
    
    for product in products:
        prices = Price.query.filter_by(product_id=product.id).all()
        
        for price in prices:
            supplier = Supplier.query.get(price.supplier_id)
            
            months_left = None
            if price.expiration_date:
                months_left = (price.expiration_date - date.today()).days / 30
            
            results.append({
                'product_id': product.id,
                'barcode': product.barcode,
                'product_name': product.name,
                'supplier_id': supplier.id,
                'supplier_name': supplier.name,
                'price': float(price.price),
                'quantity': price.quantity,
                'expiration_date': price.expiration_date.isoformat() if price.expiration_date else None,
                'months_until_expiration': round(months_left, 1) if months_left else None,
                'special_conditions': price.special_conditions,
                'is_valid': is_valid_offer(price, min_qty, min_months)
            })
    
    # Ordenar: primero validos, luego por precio
    results.sort(key=lambda x: (not x['is_valid'], x['price']))
    
    return results

def get_statistics() -> Dict:
    """Obtiene estadisticas generales"""
    total_products = Product.query.count()
    total_suppliers = Supplier.query.count()
    total_prices = Price.query.count()
    
    # Precios validos
    valid_count = 0
    all_prices = Price.query.all()
    for p in all_prices:
        if is_valid_offer(p):
            valid_count += 1
    
    return {
        'total_products': total_products,
        'total_suppliers': total_suppliers,
        'total_prices': total_prices,
        'valid_offers': valid_count,
        'invalid_offers': total_prices - valid_count
    }
