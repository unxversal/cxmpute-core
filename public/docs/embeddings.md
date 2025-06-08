# Text Embeddings

Generate high-quality vector embeddings for semantic search, RAG applications, and AI-powered features using Cxmpute's distributed embedding service.

## Overview

Cxmpute's Text Embeddings service converts text into dense vector representations that capture semantic meaning. These embeddings are essential for building semantic search, recommendation systems, and retrieval-augmented generation (RAG) applications.

### Key Features

- **High-Quality Embeddings**: State-of-the-art embedding models
- **Multiple Models**: Various embedding models optimized for different use cases
- **Batch Processing**: Efficient processing of multiple texts
- **Global Network**: Low-latency access worldwide
- **OpenAI Compatible**: Familiar API structure

## Quick Start

### Basic Request

```bash
curl -X POST https://api.cxmpute.cloud/v1/embeddings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "Cxmpute provides distributed AI inference services."
  }'
```

### Python Example

```python
import requests

url = "https://api.cxmpute.cloud/v1/embeddings"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "X-User-Id": "YOUR_USER_ID",
    "Content-Type": "application/json"
}

data = {
    "model": "nomic-embed-text",
    "input": "This is a sample text for embedding"
}

response = requests.post(url, headers=headers, json=data)
result = response.json()

embedding = result["data"][0]["embedding"]
print(f"Embedding dimension: {len(embedding)}")
```

## API Reference

### Endpoint

```http
POST /v1/embeddings
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Embedding model name |
| `input` | string/array | Yes | Text(s) to embed |
| `truncate` | boolean | No | Truncate input to model's max length |

### Available Models

| Model | Dimension | Description |
|-------|-----------|-------------|
| `nomic-embed-text` | 768 | General-purpose embeddings |
| `all-minilm-l6-v2` | 384 | Fast, lightweight |
| `bge-large-en-v1.5` | 1024 | High-quality English |

### Response Format

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding", 
      "embedding": [0.1, -0.2, 0.3, ...],
      "index": 0
    }
  ],
  "model": "nomic-embed-text",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

## Use Cases

### 1. Semantic Search

Build search systems that understand meaning, not just keywords.

### 2. Recommendation Systems

Recommend content based on semantic similarity.

### 3. RAG Applications

Enhance LLM responses with relevant context retrieval.

### 4. Document Clustering

Group similar documents automatically.

### 5. Text Classification

Classify text using embedding-based similarity.

## Pricing

During our **testnet phase**, all services are completely **free** for all users! Pricing for the mainnet launch is **to be determined (TBD)**.

Join our [Discord community](https://discord.com/invite/CJGA7B2zKT) to stay updated on pricing announcements, give feedback, and connect with other developers building with Cxmpute.

## Support

- **Discord**: [Community support](https://discord.com/invite/CJGA7B2zKT)
- **Documentation**: [Complete API reference](/docs/user)
- **Examples**: [GitHub repository](https://github.com/unxversal/cxmpute-core)

---

**Ready to build semantic applications?** Start with our high-quality embeddings and create intelligent search, recommendation, and AI systems! 