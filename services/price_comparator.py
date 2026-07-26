from datetime import date, timedelta
from typing import List, Dict
from models import db, Price, Product, Supplier
from sqlalchemy import func

def is_valid_offer(price_record: Price, min_qty: int = 5, min_months: int = 6) -> bool:
    has_enough_stock = price_record.quantity > min_qty
    
    if price_record.expiration_date:
        today = date.today()
        months_remaining = (price_record.expiration_date - today).days / 30
        has_enough_shelf_life = months_remaining > min_months
    else:
        has_enough_shelf_life = True
    
    return has_enough_stock and has_enough_shelf_life

def get_best_prices(min_qty: int = 5, min_months: int = 6) -> List[Dict]:
    # Filtrar precios que cumplan minimos de cantidad y fecha
    query = db.session.query(
        Product,
        Supplier,
        Price
    ).join(
        Product, Price.product_id == Product.id
    ).join(
        Supplier, Price.supplier_id == Supplier.id
    ).filter(
        Price.quantity > min_qty
    )
    
    if min_months > 0:
        cutoff_date = date.today() + timedelta(days=min_months * 30)
        query = query.filter(
            (Price.expiration_date.is_(None)) | 
            (Price.expiration_date > cutoff_date)
        )
    
    all_results = query.all()
    
    # Agrupar por barcode (si tiene) o por product_id
    groups = {}
    for product, supplier, price in all_results:
        group_key = product.barcode if product.barcode else f'id_{product.id}'
        
        if group_key not in groups:
            groups[group_key] = []
        
        months_left = None
        if price.expiration_date:
            months_left = (price.expiration_date - date.today()).days / 30
        
        groups[group_key].append({
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
    
    best_prices = []
    for group_key, offers in groups.items():
        # Ordenar ofertas por precio dentro de cada grupo
        offers.sort(key=lambda x: x['price'])
        # Tomar solo la mejor oferta (mas barata) de cada producto
        best = offers[0]
        best['total_offers'] = len(offers)
        best_prices.append(best)
    
    best_prices.sort(key=lambda x: x['price'])
    
    return best_prices

def compare_product(search_term: str, min_qty: int = 5, min_months: int = 6) -> List[Dict]:
    products = Product.query.filter(
        db.or_(
            Product.name.ilike(f'%{search_term}%'),
            Product.barcode.ilike(f'%{search_term}%')
        )
    ).all()
    
    if not products:
        return []
    
    # Buscar por barcode: si el search es un barcode, encontrar TODOS los productos con ese barcode
    barcode_products = set()
    for p in products:
        if p.barcode:
            same_barcode = Product.query.filter_by(barcode=p.barcode).all()
            for sb in same_barcode:
                barcode_products.add(sb.id)
    
    product_ids = set(p.id for p in products) | barcode_products
    
    results = []
    
    for pid in product_ids:
        product = Product.query.get(pid)
        if not product:
            continue
        
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
    
    results.sort(key=lambda x: (not x['is_valid'], x['price']))
    
    return results

def get_statistics() -> Dict:
    total_products = Product.query.count()
    total_suppliers = Supplier.query.count()
    total_prices = Price.query.count()
    
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
