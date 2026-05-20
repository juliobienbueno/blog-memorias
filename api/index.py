from fastapi import FastAPI

app = FastAPI()

@app.get("/api")
def hello_world():
    return {"message": "Hola, las memorias del caballero están en camino"}