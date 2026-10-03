"""
Aegis embedding microservice (Phase 1).

POST /embed   {"texts": ["..."]}  ->  {"embeddings": [[...]], "model": "...", "dim": 768}
GET  /health                      ->  {"status": "ok", "model": "...", "dim": 768}

The model is loaded once at startup. Vectors are L2-normalised, so cosine similarity == dot product.
Change the model with the EMBEDDING_MODEL env var (default: BAAI/bge-base-en-v1.5).
"""
import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-base-en-v1.5")
MAX_TEXTS = int(os.getenv("EMBEDDING_MAX_TEXTS", "32"))

state = {"model": None, "dim": None}


@asynccontextmanager
async def lifespan(_: FastAPI):
    from sentence_transformers import SentenceTransformer  # imported here so --help / syntax checks stay fast

    print(f"[embedding] loading {MODEL_NAME} (first run downloads the model, ~400 MB)...")
    state["model"] = SentenceTransformer(MODEL_NAME)
    state["dim"] = state["model"].get_sentence_embedding_dimension()
    print(f"[embedding] ready: {MODEL_NAME} (dim={state['dim']})")
    yield


app = FastAPI(title="Aegis Embedding Service", lifespan=lifespan)


class EmbedRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1)


@app.get("/health")
def health():
    if state["model"] is None:
        raise HTTPException(status_code=503, detail="model not loaded yet")
    return {"status": "ok", "model": MODEL_NAME, "dim": state["dim"]}


@app.post("/embed")
def embed(req: EmbedRequest):
    if state["model"] is None:
        raise HTTPException(status_code=503, detail="model not loaded yet")
    if len(req.texts) > MAX_TEXTS:
        raise HTTPException(status_code=413, detail=f"max {MAX_TEXTS} texts per request")
    vectors = state["model"].encode(req.texts, normalize_embeddings=True)
    return {"embeddings": vectors.tolist(), "model": MODEL_NAME, "dim": state["dim"]}
