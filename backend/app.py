from flask import Flask, send_from_directory
from flask_cors import CORS
from config import Config
from models import db
import os

def create_app():
    app = Flask(__name__, static_folder='../frontend', static_url_path='')
    app.config.from_object(Config)
    
    CORS(app)
    db.init_app(app)
    
    # Crear uploads folder
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Registrar blueprints
    from routes.upload import upload_bp
    from routes.products import products_bp
    from routes.compare import compare_bp
    
    app.register_blueprint(upload_bp, url_prefix='/api/upload')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(compare_bp, url_prefix='/api/compare')
    
    # Servir frontend
    @app.route('/')
    def index():
        return send_from_directory('../frontend', 'index.html')
    
    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory('../frontend', path)
    
    # Crear tablas
    with app.app_context():
        db.create_all()
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
