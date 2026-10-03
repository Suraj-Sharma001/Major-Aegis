# Aegis embedding service

```powershell
cd embedding-service
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8002
```

First start downloads `BAAI/bge-base-en-v1.5` (~400 MB) and then runs fully offline.
Port is **8002** so it does not clash with the main Aegis embedding service on 8001.
Check it: <http://localhost:8002/health>
