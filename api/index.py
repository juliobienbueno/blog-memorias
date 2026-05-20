import os
from fastapi import FastAPI, Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv

# Cargar las variables del archivo .env
load_dotenv()

app = FastAPI()

# Configurar el manejador para leer el token en los Headers
security_bearer = HTTPBearer()

# El token que definiste en tu .env
TOKEN_SECRETO = os.getenv("API_SECRET_TOKEN")

def verificar_token(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    """Función que valida si el token enviado es correcto"""
    if credentials.credentials != TOKEN_SECRETO:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o no proporcionado"
        )
    return credentials.credentials

# RUTA PROTEGIDA: Solo pasa si se valida el token
@app.get("/api")
def hello_world(token: str = Depends(verificar_token)):
    return {"message": "Acceso concedido. Las memorias están seguras."}