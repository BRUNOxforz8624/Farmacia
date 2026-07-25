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
    if 'file' not in request.files:
        return jsonify({'error': 'No se envio archivo'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacio'}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Archivo debe ser PDF'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    file.save(filepath)
    
    upload = Upload(
        filename=filename,
        file_type='pdf',
        status='processing'
    )
    db.session.add(upload)
    db.session.flush()
    
    try:
        products = parse_pdf(filepath)
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
    if 'file' not in request.files:
        return jsonify({'error': 'No se envio archivo'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'Nombre de archivo vacio'}), 400
    
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        return jsonify({'error': 'Archivo debe ser Excel (.xlsx o .xls)'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    file.save(filepath)
    
    upload = Upload(
        filename=filename,
        file_type='excel',
        status='processing'
    )
    db.session.add(upload)
    db.session.flush()
    
    try:
        imported = 0
        rows_found = 0
        first_row = None
        
        for product in parse_excel(filepath):
            rows_found += 1
            if first_row is None:
                first_row = product
            if save_single_product(product, upload.id):
                imported += 1
        
        db.session.commit()
        
        upload.status = 'completed'
        upload.records_imported = imported
        db.session.commit()
        
        msg = f'Se importaron {imported} productos'
        if imported == 0 and rows_found == 0:
            msg = 'No se detectaron columnas en el archivo. Revisa que tenga columnas como: Descripcion, Precio, Proveedor'
        elif imported == 0 and rows_found > 0:
            msg = f'Se encontraron {rows_found} filas pero ninguna pudo guardarse'
        
        return jsonify({
            'message': msg,
            'upload_id': upload.id,
            'records': imported,
            'debug': {
                'rows_found': rows_found,
                'rows_imported': imported,
                'first_row': first_row
            }
        })
        
    except Exception as e:
        tb = traceback.format_exc()
        upload.status = 'error'
        upload.error_message = str(e)
        db.session.commit()
        
        return jsonify({'error': str(e), 'traceback': tb}), 500

@upload_bp.route('/web', methods=['POST'])
def scrape_web():
    data = request.get_json()
    
    if not data or 'url' not in data:
        return jsonify({'error': 'Se requiere URL'}), 400
    
    url = data['url']
    
    upload = Upload(
        filename=url,
        file_type='web',
        status='processing'
    )
    db.session.add(upload)
    db.session.flush()
    
    try:
        products = scrape_url(url)
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
    uploads = Upload.query.order_by(Upload.created_at.desc()).all()
    return jsonify([u.to_dict() for u in uploads])

def save_products(products: list, upload_id: int) -> int:
    count = 0
    
    for idx, prod in enumerate(products):
        if save_single_product(prod, upload_id):
            count += 1
    
    db.session.flush()
    return count

def save_single_product(prod: dict, upload_id: int) -> bool:
    if not prod.get('name') or not prod.get('price'):
        return False
    
    try:
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
        return True
        
    except Exception as e:
        print(f"[SAVE ERROR] {prod.get('name')} - {str(e)}")
        return False
