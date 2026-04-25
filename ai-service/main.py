import os, random, requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from urllib.parse import quote

load_dotenv()
app = FastAPI(title="CivicPulse AI Service")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
ROBOFLOW_MODEL_ENDPOINT = os.getenv("ROBOFLOW_MODEL_ENDPOINT")
CATEGORIES = ["pothole", "broken_streetlight", "garbage_dump", "water_leakage"]

class ClassifyRequest(BaseModel):
    image_url: str

class ClassifyResponse(BaseModel):
    category: str
    confidence: float
    requires_review: bool

def mock_classify():
    cat = random.choice(CATEGORIES)
    conf = round(random.uniform(65, 95), 2)
    return {"category": cat, "confidence": conf, "requires_review": conf < 70}

def roboflow_classify(image_url):
    try:
        encoded = quote(image_url, safe="")
        url = f"{ROBOFLOW_MODEL_ENDPOINT}?api_key={ROBOFLOW_API_KEY}&image={encoded}&confidence=25"
        print(f"[Roboflow] Calling model...")
        r = requests.post(url, timeout=20)
        r.raise_for_status()
        data = r.json()
        preds = data.get("predictions", [])
        print(f"[Roboflow] {len(preds)} detections")
        if not preds:
            print("[Roboflow] No detections, mock fallback")
            return mock_classify()
        best = sorted(preds, key=lambda p: p.get("confidence", 0), reverse=True)[0]
        cls = best.get("class", "").lower().strip()
        conf = round(best.get("confidence", 0) * 100, 2)
        cmap = {"pothole": "pothole", "potholes": "pothole", "garbage": "garbage_dump", "garbage 1": "garbage_dump", "trash": "garbage_dump", "waste": "garbage_dump", "streetlight": "broken_streetlight", "broken streetlights": "broken_streetlight", "light": "broken_streetlight", "water": "water_leakage", "water pipe leakage": "water_leakage", "leak": "water_leakage"}
        mapped = cmap.get(cls)
        if not mapped:
            print(f"[Roboflow] Unknown '{cls}', mock fallback")
            return mock_classify()
        print(f"[Roboflow] Result: {mapped} ({conf}%)")
        return {"category": mapped, "confidence": conf, "requires_review": conf < 70}
    except Exception as e:
        print(f"[Roboflow] Error: {e}")
        return mock_classify()

@app.get("/health")
async def health():
    return {"status": "ok", "mode": "roboflow" if ROBOFLOW_API_KEY else "mock"}

@app.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest):
    if not req.image_url:
        raise HTTPException(400, "image_url required")
    if ROBOFLOW_API_KEY and ROBOFLOW_MODEL_ENDPOINT:
        return roboflow_classify(req.image_url)
    return mock_classify()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
