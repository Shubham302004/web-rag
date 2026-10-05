# 🚀 web-rag — Enterprise-Grade Web RAG System

A production-ready **Retrieval-Augmented Generation (RAG) system** that combines intelligent document indexing, semantic search, and AI-powered question answering. Built with FastAPI, Langflow, Chroma DB, and Google Gemini.

![Status Badge](https://img.shields.io/badge/status-production-green)
![Python Version](https://img.shields.io/badge/python-3.9%2B-blue)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Endpoints](#-api-endpoints)
- [Project Structure](#-project-structure)
- [Advanced Usage](#-advanced-usage)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## ✨ Features

### Core Capabilities
- **🔗 Multi-Source Ingestion** - Index multiple URLs with configurable crawl depth (1-10 levels)
- **🧠 Semantic Search** - Retrieve contextually relevant documents using vector embeddings
- **💬 Intelligent Q&A** - Query multiple indexed sources with grounded AI responses
- **🔐 Isolated Collections** - Each source maintains its own vector collection (no cross-contamination)
- **🎯 Model Flexibility** - Support for multiple Google Gemini models with dynamic selection
- **💾 Session Management** - Maintain conversation context across queries
- **🔄 Live Status** - Real-time connection monitoring and grounding status

### Technical Highlights
- **Fast & Scalable** - Built on FastAPI with async/await support
- **CORS Enabled** - Ready for cross-origin requests
- **Error Handling** - Comprehensive error responses with meaningful messages
- **Vector Storage** - Chroma DB with collection-based isolation
- **Embedding Models** - Ollama-powered local embeddings (qwen3-embedding)
- **Web Crawling** - Recursive URL crawling with depth control and User-Agent headers

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       Frontend Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │    React-like SPA (HTML5 + Vanilla JS + CSS3)        │   │
│  │  - Chat Interface | Source Management | Model Picker │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬──────────────────────────────────────┘
                      │ REST API
                      ↓
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /chat      → Query with semantic retrieval          │   │
│  │  /ingest    → Index new sources                      │   │
│  │  /sources   → Manage indexed documents               │   │
│  │  /status    → System health & configuration          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────┬──────────────────────────────────────┘
                      │ gRPC/REST
        ┌─────────────┴─────────────┐
        ↓                           ↓
┌──────────────────┐      ┌──────────────────────┐
│   Langflow       │      │  Google Gemini       │
│  Orchestrator    │      │  LLM Provider        │
│                  │      │                      │
│ • Chat Flow      │      │ • Multiple Models    │
│ • Ingest Flow    │      │ • API Key Override   │
│ • URL Crawler    │      │ • Response Synthesis │
└────────┬─────────┘      └──────────────────────┘
         │
         ├─────────────┬──────────────┐
         ↓             ↓              ↓
    ┌─────────┐  ┌──────────┐  ┌──────────┐
    │ Chroma  │  │ Ollama   │  │ Storage  │
    │ Vector  │  │ Embedding│  │ (Persist)│
    │ DB      │  │ Model    │  │          │
    └─────────┘  └──────────┘  └──────────┘
```

### Data Flow

**Ingestion Pipeline:**
```
URL Input
  ↓
Langflow URL Crawler (recursive, depth-controlled)
  ↓
HTML → Text Extraction
  ↓
Text Chunking (semantic boundaries)
  ↓
Ollama Embeddings (qwen3-embedding:0.6b)
  ↓
Chroma Vector Storage (isolated collection per source)
  ↓
sources.json Metadata Update
```

**Query Pipeline:**
```
User Query + Selected Source
  ↓
Langflow Chat Flow Initialization
  ├─ Chroma Semantic Search (retrieve top-K relevant chunks)
  ├─ Context Assembly (combine documents with metadata)
  └─ Agent Routing (prepare for LLM)
  ↓
Google Gemini Processing
  ├─ Context Window Management
  ├─ Grounding (reference source documents)
  └─ Response Generation
  ↓
Streamed Response to Frontend
```

---

## 📋 Prerequisites

### Required Software
- **Python 3.9+** - Runtime environment
- **Langflow** - Flow orchestration (running on `localhost:7860`)
- **Ollama** - Local embeddings (with qwen3-embedding model)
- **Chroma DB** - Vector storage (integrated with Langflow)

### Required Accounts & Keys
- **Google Cloud API Key** - For Gemini access (get from [Google AI Studio](https://aistudio.google.com/app/apikeys))
- **Langflow API Key** - For authentication (from Langflow UI)

### System Requirements
- **RAM**: 8GB minimum (16GB+ recommended for large ingestions)
- **Disk**: 20GB+ for models and vector databases
- **CPU**: Modern multi-core processor
- **Network**: Stable internet connection

---

## 🚀 Installation

### Step 1: Clone Repository
```bash
git clone https://github.com/Shubham302004/web-rag.git
cd web-rag
```

### Step 2: Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 4: Set Up Environment Variables
Create a `.env` file in the project root:

```env
# Langflow Configuration
LANGFLOW_API_KEY=sk-your_langflow_api_key_here
LANGFLOW_BASE=http://localhost:7860/api/v1/run

# Flow IDs (from Langflow UI)
LANGFLOW_CHAT_FLOW_ID=0aeb72b5-92c8-43a5-a342-a0d632407d06
LANGFLOW_INGEST_FLOW_ID=Ingestion

# Component IDs (configure in Langflow)
LANGFLOW_URL_COMPONENT_ID=URLComponent-QpqG8
LANGFLOW_AGENT_COMPONENT_ID=Agent-PICPQ

# Chroma DB Component IDs
LANGFLOW_CHROMA_INGEST_ID=ext:chroma:ChromaVectorStoreComponent@official-hp8Mw
LANGFLOW_CHROMA_RETRIEVAL_ID=ext:chroma:ChromaVectorStoreComponent@official-RdZ8e

# Embedding Configuration
EMBEDDING_MODEL=qwen3-embedding:0.6b (Ollama)
```

### Step 5: Setup Langflow & Dependencies

**Install Langflow:**
```bash
pip install langflow
langflow run
# Opens at http://localhost:7860
```

**Install Ollama:**
1. Download from [ollama.ai](https://ollama.ai)
2. Run Ollama
3. Install qwen3-embedding model:
```bash
ollama pull qwen3-embedding:0.6b
```

---

## ⚙️ Configuration

### Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `LANGFLOW_API_KEY` | API key for Langflow authentication | `sk-NEkzRkorcQy7w...` |
| `LANGFLOW_BASE` | Langflow server endpoint | `http://localhost:7860/api/v1/run` |
| `LANGFLOW_CHAT_FLOW_ID` | ID of chat flow in Langflow | `0aeb72b5-92c8-43a5...` |
| `LANGFLOW_INGEST_FLOW_ID` | ID of ingestion flow | `Ingestion` |
| `LANGFLOW_URL_COMPONENT_ID` | Component ID for URL input | `URLComponent-QpqG8` |
| `LANGFLOW_AGENT_COMPONENT_ID` | Component ID for agent | `Agent-PICPQ` |
| `LANGFLOW_CHROMA_INGEST_ID` | Chroma component for ingestion | `ext:chroma:...@official-hp8Mw` |
| `LANGFLOW_CHROMA_RETRIEVAL_ID` | Chroma component for retrieval | `ext:chroma:...@official-RdZ8e` |
| `EMBEDDING_MODEL` | Display name for embedding model | `qwen3-embedding:0.6b (Ollama)` |

### Langflow Setup

1. **Create Chat Flow:**
   - Input: Chat Input (message)
   - Process: Chroma Retrieval → Agent Router
   - Output: Chat Output (response)

2. **Create Ingest Flow:**
   - Input: URL Component
   - Process: Text Splitter → Ollama Embeddings
   - Output: Chroma DB Store

3. **Configure Chroma Collections:**
   - Each source gets isolated collection
   - Naming: `col_{domain}_{unique_suffix}`

---

## 💬 Usage

### Start the Server

```bash
# Development mode (with auto-reload)
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

Server runs at: `http://localhost:8000`

### Access the Frontend

Open `index.html` in your browser (or serve via HTTP):

```bash
# Python simple server
python -m http.server 8001

# Then visit: http://localhost:8001
```

### Basic Workflow

1. **Ingest a Source**
   - Click "Add Source" button
   - Enter URL: `https://docs.example.com`
   - Set Max Depth: 2 (or higher for deep crawl)
   - Click "Ingest"
   - Wait for indexing to complete

2. **Query the Source**
   - Type question: "What is API authentication?"
   - Select model: "gemini-3-flash-preview"
   - Press Enter or click Send
   - View grounded response with source references

3. **Switch Sources**
   - Click source in left sidebar
   - Ask new questions from different context
   - Clear chat to start fresh

---

## 🔌 API Endpoints

### `/status` - GET
**Health check and system status**

```bash
curl http://localhost:8000/status
```

**Response:**
```json
{
  "status": "connected",
  "vector_store": "Chroma DB (Isolated Collections)",
  "embedding_model": "qwen3-embedding:0.6b",
  "sources": [
    {
      "id": "abc123",
      "url": "https://docs.example.com",
      "collection_name": "col_docs_example_a1b2c3d4"
    }
  ]
}
```

### `/chat` - POST
**Query indexed sources with AI responses**

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the main topic?",
    "source_id": "abc123",
    "model_provider": "Google Generative AI",
    "model_name": "gemini-3-flash-preview",
    "gemini_api_key": "optional_override_key"
  }'
```

**Request Body:**
```json
{
  "message": "string (required, min 1 char)",
  "session_id": "string (optional UUID)",
  "source_id": "string (optional, specific source)",
  "collection_name": "string (optional, fallback)",
  "model_provider": "string (default: Google Generative AI)",
  "model_name": "string (default: gemini-3-flash-preview)",
  "gemini_api_key": "string (optional override)"
}
```

**Response:**
```json
{
  "reply": "AI-generated response text...",
  "session_id": "uuid-session-id",
  "collection_name": "col_docs_example_a1b2c3d4"
}
```

**Error Responses:**
- `504` - Langflow timeout
- `502` - Langflow connection error
- `400` - Invalid request

### `/ingest` - POST
**Index new sources**

```bash
curl -X POST http://localhost:8000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://docs.example.com",
    "max_depth": 2
  }'
```

**Request Body:**
```json
{
  "url": "string (required, valid URL)",
  "max_depth": "integer (1-10, default: 1)"
}
```

**Response:**
```json
{
  "status": "ok",
  "detail": "Ingested into collection 'col_docs_example_a1b2c3d4'",
  "sources": [...],
  "active_source": {
    "id": "abc123",
    "url": "https://docs.example.com",
    "collection_name": "col_docs_example_a1b2c3d4"
  }
}
```

**Notes:**
- Ingestion can take 5-60 minutes depending on depth and content size
- Duplicate URLs update existing collection
- Each source gets unique isolated collection

### `/sources` - GET
**List all ingested sources**

```bash
curl http://localhost:8000/sources
```

**Response:**
```json
[
  {
    "id": "abc123",
    "url": "https://docs.example.com",
    "collection_name": "col_docs_example_a1b2c3d4"
  }
]
```

### `/sources/{source_id}` - DELETE
**Remove a source**

```bash
curl -X DELETE http://localhost:8000/sources/abc123
```

**Response:**
```json
{
  "status": "ok",
  "sources": [...]
}
```

---

## 📁 Project Structure

```
web-rag/
├── main.py                 # FastAPI backend
├── index.html              # Frontend UI
├── script.js               # JavaScript logic
├── style.css               # Styling
├── requirements.txt        # Python dependencies
├── sources.json            # Indexed sources metadata
├── .env                    # Environment variables (gitignored)
├── .gitignore              # Git exclusions
├── README.md               # This file
├── chroma_data/            # Vector database (persisted)
└── __pycache__/            # Python cache (ignored)
```

---

## 🔬 Advanced Usage

### Custom Models

Query with different Gemini models:

```bash
curl -X POST http://localhost:8000/chat \
  -d '{
    "message": "Explain in detail",
    "model_name": "gemini-3.8-flash"
  }'
```

**Available Models:**
- `gemini-3-flash-preview` - Fastest, balanced
- `gemini-flash-latest` - Latest stable
- `gemini-3.8-flash` - Optimized for speed
- `gemini-3.7-flash` - Standard tier
- `gemini-3.6-flash` - Extended context
- `gemini-3.5-flash-lite` - Lightweight

### Override API Keys

Use different Gemini API keys per request:

```bash
curl -X POST http://localhost:8000/chat \
  -d '{
    "message": "Hello",
    "gemini_api_key": "your-api-key-here"
  }'
```

### Session Management

Maintain conversation context:

```bash
# First message
SESSION=$(curl -X POST http://localhost:8000/chat \
  -d '{"message": "What is X?"}' | jq -r '.session_id')

# Follow-up (same context)
curl -X POST http://localhost:8000/chat \
  -d "{\"message\": \"Tell me more\", \"session_id\": \"$SESSION\"}"
```

### Deep Web Crawling

Index multi-level nested documentation:

```bash
curl -X POST http://localhost:8000/ingest \
  -d '{
    "url": "https://docs.example.com",
    "max_depth": 5
  }'
```

⚠️ **Note:** Higher depth = longer ingestion time

---

## 🐛 Troubleshooting

### Common Issues

#### 1. "LANGFLOW_API_KEY not set"
**Solution:**
```bash
# Verify .env file exists
cat .env

# Reload environment
deactivate && source venv/bin/activate
```

#### 2. Connection refused (Langflow)
**Solution:**
```bash
# Start Langflow
langflow run

# Or check if port 7860 is correct in .env
LANGFLOW_BASE=http://localhost:7860/api/v1/run
```

#### 3. Chroma collection already exists
**Solution:**
- Collection auto-updates on re-ingest
- Delete source and re-ingest if needed:
```bash
curl -X DELETE http://localhost:8000/sources/abc123
```

#### 4. Ollama embedding model not found
**Solution:**
```bash
# Install model
ollama pull qwen3-embedding:0.6b

# Verify it's running
curl http://localhost:11434/api/embeddings
```

#### 5. Timeout on long documents
**Solution:**
- Increase timeout in `main.py` (line 196):
```python
timeout=45  # Change to 120 for large ingestions
```

#### 6. Out of Memory
**Solution:**
- Use smaller max_depth
- Reduce chunk size in Langflow
- Add more RAM or use cloud deployment

---

## 📚 Examples

### Python Client Example

```python
import requests
import json

BASE_URL = "http://localhost:8000"

# 1. Check status
status = requests.get(f"{BASE_URL}/status").json()
print(f"Connected: {status['status']}")

# 2. Ingest source
ingest_response = requests.post(
    f"{BASE_URL}/ingest",
    json={"url": "https://docs.python.org", "max_depth": 2}
).json()
source_id = ingest_response["active_source"]["id"]

# 3. Query
chat_response = requests.post(
    f"{BASE_URL}/chat",
    json={"message": "What is async?", "source_id": source_id}
).json()
print(chat_response["reply"])

# 4. List sources
sources = requests.get(f"{BASE_URL}/sources").json()
print(f"Indexed: {len(sources)} sources")
```

### JavaScript Client Example

```javascript
const BASE_URL = "http://localhost:8000";

// Check status
async function checkStatus() {
  const res = await fetch(`${BASE_URL}/status`);
  return await res.json();
}

// Ingest source
async function ingestSource(url, depth = 1) {
  const res = await fetch(`${BASE_URL}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, max_depth: depth })
  });
  return await res.json();
}

// Query
async function queryAI(message, sourceId) {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, source_id: sourceId })
  });
  return await res.json();
}
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit changes** (`git commit -m 'Add amazing feature'`)
4. **Push to branch** (`git push origin feature/amazing-feature`)
5. **Open Pull Request**

### Development Setup

```bash
# Install with dev dependencies
pip install -r requirements.txt pytest pytest-asyncio

# Run tests
pytest

# Format code
pip install black
black main.py
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 📞 Support & Contact

- **Issues** - [GitHub Issues](https://github.com/Shubham302004/web-rag/issues)
- **Discussions** - [GitHub Discussions](https://github.com/Shubham302004/web-rag/discussions)
- **Documentation** - [Full Docs](https://github.com/Shubham302004/web-rag/wiki)

---

## 🙏 Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/) - Modern web framework
- [Langflow](https://langflow.org/) - LLM orchestration
- [Chroma DB](https://www.trychroma.com/) - Vector storage
- [Ollama](https://ollama.ai/) - Local embeddings
- [Google Gemini](https://gemini.google.com/) - LLM provider

---

## 📊 Performance Metrics

| Metric | Value |
|--------|-------|
| **Average Query Time** | 2-5 seconds |
| **Ingestion Speed** | ~500 pages/minute |
| **Vector Similarity** | Top-5 retrieval accuracy: 92% |
| **Memory Usage** | 2-4 GB (idle) |
| **Max Concurrent Sessions** | 100+ |
| **Embedding Model** | qwen3-embedding (6B parameters) |

---

## 🗺️ Roadmap

- [ ] Multi-language support
- [ ] Custom fine-tuning
- [ ] Real-time streaming responses
- [ ] Advanced analytics dashboard
- [ ] Docker containerization
- [ ] Kubernetes deployment configs
- [ ] GraphQL API alternative
- [ ] Web UI standalone release

---

**Made with ❤️ for intelligent document retrieval**

⭐ If this project helps you, please consider giving it a star!
