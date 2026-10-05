from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import requests
import os
import uuid
import json
import re
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="RAG Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

api_key = os.environ.get("LANGFLOW_API_KEY")
if not api_key:
    raise ValueError("LANGFLOW_API_KEY environment variable not set")

LANGFLOW_BASE = os.environ.get("LANGFLOW_BASE", "http://localhost:7860/api/v1/run")

# The chat/retrieval flow (Chat Input -> Chroma DB search -> Agent -> Chat Output)
CHAT_FLOW_ID = os.environ.get("LANGFLOW_CHAT_FLOW_ID", "0aeb72b5-92c8-43a5-a342-a0d632407d06")

# The ingestion flow (URL -> Split Text -> Ollama Embeddings -> Chroma DB ingest).
INGEST_FLOW_ID = os.environ.get("LANGFLOW_INGEST_FLOW_ID", "Ingestion")
URL_COMPONENT_ID = os.environ.get("LANGFLOW_URL_COMPONENT_ID", "URLComponent-QpqG8")
AGENT_COMPONENT_ID = os.environ.get("LANGFLOW_AGENT_COMPONENT_ID", "Agent-PICPQ")

# Chroma DB Component IDs
CHROMA_INGEST_ID = os.environ.get("LANGFLOW_CHROMA_INGEST_ID", "ext:chroma:ChromaVectorStoreComponent@official-hp8Mw")
CHROMA_RETRIEVAL_ID = os.environ.get("LANGFLOW_CHROMA_RETRIEVAL_ID", "ext:chroma:ChromaVectorStoreComponent@official-RdZ8e")

# Dynamic embedding model configuration
EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL")

headers = {"x-api-key": api_key}

SOURCES_FILE = Path(__file__).parent / "sources.json"


def generate_collection_name(url: str) -> str:
    try:
        parsed = urllib.parse.urlparse(url)
        host = parsed.netloc or parsed.path
        clean_name = re.sub(r"[^a-zA-Z0-9]", "_", host).strip("_")[:20]
    except Exception:
        clean_name = "src"

    if not clean_name:
        clean_name = "src"

    unique_suffix = uuid.uuid4().hex[:8]
    col = f"col_{clean_name}_{unique_suffix}".strip("_")
    return col[:60]


def load_sources() -> list[dict]:
    if SOURCES_FILE.exists():
        try:
            with open(SOURCES_FILE, "r", encoding="utf-8") as f:
                sources = json.load(f)
                changed = False
                for s in sources:
                    if not s.get("collection_name"):
                        s["collection_name"] = generate_collection_name(s.get("url", "source"))
                        changed = True
                if changed:
                    save_sources(sources)
                return sources
        except Exception:
            return []
    return []


def save_sources(sources: list[dict]):
    try:
        with open(SOURCES_FILE, "w", encoding="utf-8") as f:
            json.dump(sources, f, indent=2)
    except Exception:
        pass


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    session_id: str | None = None
    model_provider: str | None = None  # e.g. "Google Generative AI"
    model_name: str | None = None      # e.g. "gemini-3.5-flash-lite"
    source_id: str | None = None
    collection_name: str | None = None
    gemini_api_key: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    collection_name: str | None = None


class IngestRequest(BaseModel):
    url: str = Field(..., min_length=1)
    max_depth: int = Field(default=1, ge=1, le=10)


class IngestResponse(BaseModel):
    status: str
    detail: str
    sources: list[dict]
    active_source: dict | None = None


class StatusResponse(BaseModel):
    status: str
    vector_store: str
    embedding_model: str
    sources: list[dict]


@app.get("/status", response_model=StatusResponse)
def get_status():
    sources = load_sources()
    return StatusResponse(
        status="connected",
        vector_store="Chroma DB (Isolated Collections)",
        embedding_model=EMBEDDING_MODEL or "Detecting...",
        sources=sources
    )


@app.get("/sources")
def get_sources():
    return load_sources()


@app.delete("/sources/{source_id}")
def delete_source(source_id: str):
    sources = load_sources()
    updated = [s for s in sources if s.get("id") != source_id]
    save_sources(updated)
    return {"status": "ok", "sources": updated}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    session_id = request.session_id or str(uuid.uuid4())

    payload = {
        "output_type": "chat",
        "input_type": "chat",
        "input_value": request.message,
        "session_id": session_id
    }

    tweaks = {}

    # Override Model Provider, Model Name & API Key if specified
    if request.model_provider and request.model_name and AGENT_COMPONENT_ID:
        model_dict = {"provider": request.model_provider, "name": request.model_name}
        if request.gemini_api_key:
            model_dict["api_key"] = request.gemini_api_key

        agent_tweak = {"model": [model_dict]}
        if request.gemini_api_key:
            agent_tweak["api_key"] = request.gemini_api_key

        tweaks[AGENT_COMPONENT_ID] = agent_tweak

    # Dynamically inject the target collection for retrieval
    target_collection = None
    if request.source_id:
        sources = load_sources()
        match = next((s for s in sources if s.get("id") == request.source_id), None)
        if match:
            target_collection = match.get("collection_name")

    if not target_collection:
        target_collection = request.collection_name

    if target_collection and CHROMA_RETRIEVAL_ID:
        tweaks[CHROMA_RETRIEVAL_ID] = {
            "collection_name": target_collection
        }

    if tweaks:
        payload["tweaks"] = tweaks

    try:
        response = requests.post(f"{LANGFLOW_BASE}/{CHAT_FLOW_ID}", json=payload, headers=headers, timeout=45)
        response.raise_for_status()
        data = response.json()
        reply = data["outputs"][0]["outputs"][0]["outputs"]["message"]["message"]
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Langflow agent timed out")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Error contacting Langflow: {e}")
    except (KeyError, IndexError):
        raise HTTPException(status_code=502, detail="Unexpected response shape from Langflow")

    return ChatResponse(reply=reply, session_id=session_id, collection_name=target_collection)


@app.post("/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest):
    if not INGEST_FLOW_ID or not URL_COMPONENT_ID:
        raise HTTPException(
            status_code=500,
            detail="LANGFLOW_INGEST_FLOW_ID / LANGFLOW_URL_COMPONENT_ID not configured"
        )

    sources = load_sources()
    # Check if URL already exists
    existing = next((s for s in sources if s.get("url") == request.url), None)
    if existing:
        collection_name = existing.get("collection_name") or generate_collection_name(request.url)
        existing["collection_name"] = collection_name
        active_source = existing
    else:
        collection_name = generate_collection_name(request.url)
        active_source = {
            "id": str(uuid.uuid4()),
            "url": request.url,
            "collection_name": collection_name
        }
        sources.append(active_source)

    # Tweaks for Ingestion
    tweaks = {
        URL_COMPONENT_ID: {
            "urls": [request.url],
            "headers": [
                {
                    "key": "User-Agent",
                    "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                }
            ],
            "max_depth": request.max_depth
        }
    }
    if CHROMA_INGEST_ID:
        tweaks[CHROMA_INGEST_ID] = {"collection_name": collection_name}

    payload = {
        "output_type": "text",
        "input_type": "text",
        "input_value": "",
        "tweaks": tweaks
    }

    try:
        response = requests.post(
            f"{LANGFLOW_BASE}/{INGEST_FLOW_ID}", json=payload, headers=headers, timeout=600
        )
        response.raise_for_status()
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Ingestion timed out")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Error contacting Langflow: {e}")

    save_sources(sources)

    return IngestResponse(
        status="ok",
        detail=f"Ingested into collection '{collection_name}'",
        sources=sources,
        active_source=active_source
    )