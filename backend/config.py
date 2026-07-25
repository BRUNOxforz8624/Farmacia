import os
from datetime import timedelta

class Config:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max
    
    # SQLite (no requiere servidor)
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'sqlite:///' + os.path.join(BASE_DIR, '..', 'database', 'farmacia.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Filtros por defecto
    MIN_QUANTITY = 5
    MIN_MONTHS_SHELF_LIFE = 6
    
    # Secret key para produccion
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
