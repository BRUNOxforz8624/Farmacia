from flask import Flask, send_from_directory
from flask_cors import CORS
from config import Config
from models import db
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def create_app():
    app = Flask(__name__, static_folder=os.path.join(BASE_DIR, 'frontend'), static_url_path='')
    app.config.from_object(Config)
    
    CORS(app)
    db.init_app(app)
    
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    from routes.upload import upload_bp
    from routes.products import products_bp
    from routes.compare import compare_bp
    
    app.register_blueprint(upload_bp, url_prefix='/api/upload')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(compare_bp, url_prefix='/api/compare')
    
    @app.route('/')
    def index():
        return send_from_directory(os.path.join(BASE_DIR, 'frontend'), 'index.html')
    
    @app.route('/<path:path>')
    def serve_static(path):
        return send_from_directory(os.path.join(BASE_DIR, 'frontend'), path)
    
    with app.app_context():
        db.create_all()
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
