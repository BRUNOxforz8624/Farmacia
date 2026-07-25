from flask import Blueprint, request, jsonify, send_file
from services.price_comparator import get_best_prices, compare_product
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
import io
from datetime import datetime

compare_bp = Blueprint('compare', __name__)

@compare_bp.route('/best', methods=['GET'])
def best_prices():
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
    min_qty = request.args.get('min_qty', 5, type=int)
    min_months = request.args.get('min_months', 6, type=int)
    
    results = get_best_prices(min_qty, min_months)
    
    if not results:
        return jsonify({'message': 'No se encontraron productos que cumplan los filtros'})
    
    cheapest = results[0]
    
    return jsonify(cheapest)

@compare_bp.route('/export', methods=['GET'])
def export_excel():
    min_qty = request.args.get('min_qty', 5, type=int)
    min_months = request.args.get('min_months', 6, type=int)
    search = request.args.get('q', '')
    
    if search:
        results = compare_product(search, min_qty, min_months)
    else:
        results = get_best_prices(min_qty, min_months)
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Resultados"
    
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    
    headers = ["Codigo", "Producto", "Proveedor", "Precio", "Cantidad", "Vencimiento", "Condicion", "Estado"]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
    
    for row, item in enumerate(results, 2):
        ws.cell(row=row, column=1, value=item.get('barcode', '-'))
        ws.cell(row=row, column=2, value=item.get('product_name', ''))
        ws.cell(row=row, column=3, value=item.get('supplier_name', ''))
        ws.cell(row=row, column=4, value=item.get('price', 0))
        ws.cell(row=row, column=5, value=item.get('quantity', 0))
        ws.cell(row=row, column=6, value=item.get('months_until_expiration', 'N/A'))
        ws.cell(row=row, column=7, value=item.get('special_conditions', '-'))
        ws.cell(row=row, column=8, value='Valida' if item.get('is_valid') else 'Rechazada')
    
    ws.column_dimensions['A'].width = 15
    ws.column_dimensions['B'].width = 30
    ws.column_dimensions['C'].width = 20
    ws.column_dimensions['D'].width = 12
    ws.column_dimensions['E'].width = 12
    ws.column_dimensions['F'].width = 15
    ws.column_dimensions['G'].width = 20
    ws.column_dimensions['H'].width = 12
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"farmapp_resultados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )
