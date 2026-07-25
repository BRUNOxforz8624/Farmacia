from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from models import db, Upload, Price, Product, Supplier
from services.pdf_parser import parse_pdf
from services.excel_parser import parse_excel
from services.web_scraper import scrape_url
import os
import traceback
from datetime import datetime

upload_bp = Blueprint('upload', __name__)

@upload_bp.route('/pdf', methods=['POST'])
def upload_pdf():
    """Subir y procesar un archivo PDF"""
    if 'file' not in request.files:
        return jsonify({'error': 'No se envio archivo'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacio'}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Archivo debe ser PDF'}), 400
    
    # Guardar archivo
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Crear registro de upload
    upload = Upload(
        filename=filename,
        file_type='pdf',
        status='processing'
    )
    db.session.add(upload)
    db.session.flush()
    
    try:
        # Parsear PDF
        products = parse_pdf(filepath)
        
        # Guardar en base de datos
        imported = save_products(products, upload.id)
        
        upload.status = 'completed'
        upload.records_imported = imported
        db.session.commit()
        
        return jsonify({
            'message': f'Se importaron {imported} productos',
            'upload_id': upload.id,
            'records': imported
        })
        
    except Exception as e:
        upload.status = 'error'
        upload.error_message = str(e)
        db.session.commit()
        
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/excel', methods=['POST'])
def upload_excel():
    """Subir y procesar un archivo Excel"""
    if 'file' not in request.files:
        return jsonify({'error': 'No se envio archivo'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacio'}), 400
    
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({'error': 'Archivo debe ser Excel (.xlsx o .xls)'}), 400
    
    # Guardar archivo
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Crear registro de upload
    upload = Upload(
        filename=filename,
        file_type='excel',
        status='processing'
    )
    db.session.add(upload)
    db.session.flush()
    
    try:
        # Parsear Excel
        products = parse_excel(filepath)
        
        print(f"[EXCEL] Archivo: {filename}")
        print(f"[EXCEL] Productos extraidos: {len(products)}")
        
        if products:
            print(f"[EXCEL] Primer producto: {products[0]}")
        
        # Guardar en base de datos
        imported = save_products(products, upload.id)
        
        print(f"[EXCEL] Importados a BD: {imported}")
        
        upload.status = 'completed'
        upload.records_imported = imported
        db.session.commit()
        
        return jsonify({
            'message': f'Se importaron {imported} productos',
            'upload_id': upload.id,
            'records': imported
        })
        
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[EXCEL ERROR] {str(e)}")
        print(f"[EXCEL ERROR] {tb}")
        upload.status = 'error'
        upload.error_message = str(e)
        db.session.commit()
        
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/web', methods=['POST'])
def scrape_web():
    """Scrapear una pagina web"""
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({'error': 'Se requiere URL'}), 400
    
    url = data['url']
    
    # Crear registro de upload
    upload = Upload(
        filename=url,
        file_type='web',
        status='processing'
    )
    db.session.add(upload)
    db.session.flush()
    
    try:
        # Scrapear URL
        products = scrape_url(url)
        
        # Guardar en base de datos
        imported = save_products(products, upload.id)
        
        upload.status = 'completed'
        upload.records_imported = imported
        db.session.commit()
        
        return jsonify({
            'message': f'Se importaron {imported} productos',
            'upload_id': upload.id,
            'records': imported
        })
        
    except Exception as e:
        upload.status = 'error'
        upload.error_message = str(e)
        db.session.commit()
        
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/history', methods=['GET'])
def upload_history():
    """Obtener historial de cargas"""
    uploads = Upload.query.order_by(Upload.created_at.desc()).all()
    return jsonify([u.to_dict() for u in uploads])

def save_products(products: list, upload_id: int) -> int:
    """Guarda productos extraidos en la base de datos"""
    count = 0
    
    for idx, prod in enumerate(products):
        if not prod.get('name') or not prod.get('price'):
            continue
        
        try:
            # Buscar o crear proveedor
            supplier = None
            if prod.get('supplier'):
                supplier = Supplier.query.filter_by(name=prod['supplier']).first()
                if not supplier:
                    supplier = Supplier(name=prod['supplier'])
                    db.session.add(supplier)
                    db.session.flush()
            else:
                supplier = Supplier.query.filter_by(name='Desconocido').first()
                if not supplier:
                    supplier = Supplier(name='Desconocido')
                    db.session.add(supplier)
                    db.session.flush()
            
            # Buscar o crear producto
            barcode = prod.get('barcode')
            product = None
            if barcode:
                product = Product.query.filter_by(barcode=barcode).first()
            if not product:
                product = Product.query.filter_by(name=prod['name']).first()
            if not product:
                product = Product(
                    barcode=barcode,
                    name=prod['name']
                )
                db.session.add(product)
                db.session.flush()
            
            # Crear registro de precio
            price = Price(
                product_id=product.id,
                supplier_id=supplier.id,
                price=prod['price'],
                quantity=prod.get('quantity', 0),
                expiration_date=prod.get('expiration_date'),
                special_conditions=prod.get('special_conditions'),
                upload_id=upload_id
            )
            db.session.add(price)
            count += 1
            
            if count % 100 == 0:
                db.session.flush()
                
        except Exception as e:
            print(f"[SAVE ERROR] Producto {idx}: {prod.get('name')} - {str(e)}")
            continue
    
    db.session.flush()
    return count
