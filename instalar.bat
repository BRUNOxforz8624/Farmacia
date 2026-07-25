@echo off
title FarmApp - Instalador
echo ========================================
echo    FarmApp - Instalador
echo ========================================
echo.

:: Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no encontrado
    echo Descarga Python desde: https://www.python.org/downloads/
    echo Marca "Add Python to PATH" al instalar
    pause
    exit /b 1
)

echo [OK] Python encontrado
echo.

:: Instalar dependencias
echo Instalando dependencias...
cd /d "%~dp0backend"
pip install -r requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Error al instalar dependencias
    pause
    exit /b 1
)

echo [OK] Dependencias instaladas
echo.

:: Crear acceso directo en escritorio
echo Creando acceso directo en escritorio...
set "desktop=%USERPROFILE%\Desktop"
set "vbs_path=%desktop%\FarmApp.vbs"

echo Set WshShell = CreateObject("WScript.Shell") > "%vbs_path%"
echo Set fso = CreateObject("Scripting.FileSystemObject") >> "%vbs_path%"
echo scriptPath = "%~dp0" >> "%vbs_path%"
echo WshShell.Run chr(34) ^& scriptPath ^& "start.bat" ^& chr(34), 0, False >> "%vbs_path%"
echo WScript.Sleep 4000 >> "%vbs_path%"
echo WshShell.Run "http://localhost:5000", 1, False >> "%vbs_path%"

echo [OK] Acceso directo creado en Escritorio
echo.

echo ========================================
echo    Instalacion completa!
echo ========================================
echo.
echo Para usar FarmApp:
echo   1. Haz doble clic en "FarmApp" en tu Escritorio
echo   2. Se abrira automaticamente en tu navegador
echo   3. Para cerrar, cierra la pestana del navegador
echo       y presiona Ctrl+C en la ventana de servidor
echo.
pause
