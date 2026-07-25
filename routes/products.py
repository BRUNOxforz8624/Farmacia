from flask import Blueprint, request, jsonify
from models import db, Product, Supplier, Price
from sqlalchemy import or_

products_bp = Blueprint('products', __name__)

@products_bp.route('/', methods=['GET'])
def list_products():
    """Listar todos los productos"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    search = request.args.get('search', '')
    
    query = Product.query
    
    if search:
        query = query.filter(
            or_(
                Product.name.ilike(f'%{search}%'),
                Product.barcode.ilike(f'%{search}%')
            )
        )
    
    products = query.paginate(page=page, per_page=per_page)
    
    return jsonify({
        'products': [p.to_dict() for p in products.items],
        'total': products.total,
        'pages': products.pages,
        'current_page': products.page
    })

@products_bp.route('/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Obtener un producto por ID"""
    product = Product.query.get_or_404(product_id)
    
    # Obtener precios del producto
    prices = Price.query.filter_by(product_id=product_id).all()
    prices_data = []
    
    for price in prices:
        supplier = Supplier.query.get(price.supplier_id)
        prices_data.append({
            **price.to_dict(),
            'supplier_name': supplier.name if supplier else 'Desconocido'
        })
    
    return jsonify({
        'product': product.to_dict(),
        'prices': prices_data
    })

@products_bp.route('/', methods=['POST'])
def create_product():
    """Crear un producto nuevo"""
    data = request.get_json()
    
    if not data or 'name' not in data:
        return jsonify({'error': 'Nombre es requerido'}), 400
    
    product = Product(
        barcode=data.get('barcode'),
        name=data['name']
    )
    
    db.session.add(product)
    db.session.commit()
    
    return jsonify(product.to_dict()), 201

@products_bp.route('/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    """Actualizar un producto"""
    product = Product.query.get_or_404(product_id)
    data = request.get_json()
    
    if 'barcode' in data:
        product.barcode = data['barcode']
    if 'name' in data:
        product.name = data['name']
    
    db.session.commit()
    
    return jsonify(product.to_dict())

@products_bp.route('/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    """Eliminar un producto"""
    product = Product.query.get_or_404(product_id)
    
    # Eliminar precios asociados
    Price.query.filter_by(product_id=product_id).delete()
    
    db.session.delete(product)
    db.session.commit()
    
    return jsonify({'message': 'Producto eliminado'})

@products_bp.route('/suppliers', methods=['GET'])
def list_suppliers():
    """Listar todos los proveedores"""
    suppliers = Supplier.query.all()
    return jsonify([s.to_dict() for s in suppliers])

@products_bp.route('/stats', methods=['GET'])
def get_stats():
    """Obtener estadisticas"""
    from services.price_comparator import get_statistics
    stats = get_statistics()
    return jsonify(stats)
