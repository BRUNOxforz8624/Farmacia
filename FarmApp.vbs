Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Obtener ruta del script
scriptPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Ejecutar start.bat sin ventana
WshShell.Run chr(34) & scriptPath & "\start.bat" & chr(34), 0, False

' Esperar a que el servidor este listo y abrir navegador
WScript.Sleep 4000
WshShell.Run "http://localhost:5000", 1, False
