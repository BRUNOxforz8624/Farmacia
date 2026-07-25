from flask import Blueprint, request, jsonify
from services.price_comparator import get_best_prices, compare_product

compare_bp = Blueprint('compare', __name__)

@compare_bp.route('/best', methods=['GET'])
def best_prices():
    """
    Obtener mejores precios por producto.
    Filtros:
    - min_qty: cantidad minima (default 5)
    - min_months: meses minimos de vida (default 6)
    """
    min_qty = request.args.get('min_qty', 5, type=int)
    min_months = request.args.get('min_months', 6, type=int)
    
    results = get_best_prices(min_qty, min_months)
    
    return jsonify({
        'filters': {
            'min_quantity': min_qty,
            'min_months': min_months
        },
        'results': results,
        'total': len(results)
    })

@compare_bp.route('/product', methods=['GET'])
def compare_prices():
    """
    Comparar precios de un producto especifico.
    Parametros:
    - q: nombre del producto (busqueda parcial)
    - min_qty: cantidad minima (default 5)
    - min_months: meses minimos de vida (default 6)
    """
    product_name = request.args.get('q', '')
    
    if not product_name:
        return jsonify({'error': 'Se requiere parametro q (nombre del producto)'}), 400
    
    min_qty = request.args.get('min_qty', 5, type=int)
    min_months = request.args.get('min_months', 6, type=int)
    
    results = compare_product(product_name, min_qty, min_months)
    
    return jsonify({
        'query': product_name,
        'filters': {
            'min_quantity': min_qty,
            'min_months': min_months
        },
        'results': results,
        'total': len(results)
    })

@compare_bp.route('/cheapest', methods=['GET'])
def cheapest():
    """Obtener el producto mas barato que cumpla filtros"""
    min_qty = request.args.get('min_qty', 5, type=int)
    min_months = request.args.get('min_months', 6, type=int)
    
    results = get_best_prices(min_qty, min_months)
    
    if not results:
        return jsonify({'message': 'No se encontraron productos que cumplan los filtros'})
    
    cheapest = results[0]
    
    return jsonify(cheapest)
