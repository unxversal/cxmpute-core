Welcome to Cxmpute! This guide will help you get started using our AI services through our simple, OpenAI-compatible APIs.

## Overview

Cxmpute provides an inference and related services powered by a global network of nodes run by providers. We offer:

- **LLM inference** with dozens of popular models
- **Text embeddings** for semantic search and RAG applications  
- **Text-to-speech** with natural voice synthesis
- **Web scraping** with intelligent content extraction
- **Tool use and JSON mode** for structured outputs

Learn more about specific use cases:
- [Text-to-Speech](/docs/text-to-speech)
- [Text-to-Text (LLM)](/docs/text-to-text) 
- [Embeddings](/docs/embeddings)
- [Web Scraping](/docs/scraping)
- [Tool Use & JSON](/docs/tool-use-json)
- [Advanced LLMs](/docs/advanced-llms)

## Getting Started

### 1. Create Your Account

Go to the [Cxmpute Dashboard](https://cxmpute.cloud/dashboard) to create your account.

### 2. Get Your API Key

When your account is created, you'll see your base user API key. This key has **no limits** in terms of usage and accessible services during our testnet phase.

⚠️ **Important**: Practice good key management. Never expose your API keys in client-side code or public repositories. If your key has been compromised, refresh it immediately in the dashboard.

### 3. Create Virtual API Keys (Optional)

You can create virtual API keys with specific limitations:
- **Spend limits**: Set maximum credit usage
- **Service restrictions**: Limit access to specific endpoints
- **Usage tracking**: Monitor usage per key

## Authentication

All API requests require authentication using your API key:

```bash
Authorization: Bearer YOUR_API_KEY
X-User-Id: YOUR_USER_ID
```

### Required Headers

- `Authorization`: Your API key in Bearer token format
- `X-User-Id`: Your user ID from the dashboard
- `Content-Type: application/json` (for POST requests)

### Optional Headers

- `X-Title`: Service title for analytics
- `HTTP-Referer`: Service URL for analytics

## Base URL

All API endpoints use the base URL:
```
https://cxmpute.cloud/api
```

## API Reference

### Chat Completions

**OpenAI-compatible endpoint** for text generation and conversations.

```http
POST /v1/chat/completions
```

#### Request Body

```json
{
  "model": "llama3.1:8b",
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "stream": false,
  "temperature": 0.7,
  "max_tokens": 1000
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model name (see [model catalog](https://cxmpute.cloud/models)) |
| `messages` | array | Yes | Array of message objects with `role` and `content` |
| `stream` | boolean | No | Enable streaming responses (default: false) |
| `temperature` | number | No | Sampling temperature 0-2 (default: 0.7) |
| `max_tokens` | number | No | Maximum tokens to generate |
| `top_p` | number | No | Nucleus sampling parameter |
| `response_format` | string/object | No | Response format (see [JSON mode](/docs/tool-use-json)) |
| `tools` | array | No | Available tools for function calling |

#### Response

**Non-streaming:**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "llama3.1:8b",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! I'm doing well, thank you for asking. How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

**Streaming:**
```
data: {"choices":[{"delta":{"content":"Hello"}}]}
data: {"choices":[{"delta":{"content":"!"}}]}
data: [DONE]
```

#### Example

```bash
curl -X POST https://cxmpute.cloud/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [
      {"role": "user", "content": "Write a haiku about AI"}
    ],
    "temperature": 0.8
  }'
```

### Embeddings

Generate vector embeddings for text.

```http
POST /v1/embeddings
```

#### Request Body

```json
{
  "model": "nomic-embed-text",
  "input": "Your text to embed",
  "truncate": true
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Embedding model name |
| `input` | string/array | Yes | Text(s) to embed |
| `truncate` | boolean | No | Truncate input to model's max length |

#### Response

```json
{
  "object": "list",
  "data": [{
    "object": "embedding",
    "embedding": [0.1, -0.2, 0.3, ...],
    "index": 0
  }],
  "model": "nomic-embed-text",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

#### Example

```bash
curl -X POST https://cxmpute.cloud/api/v1/embeddings \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nomic-embed-text",
    "input": "This is a sample text for embedding"
  }'
```

### Text-to-Speech

Convert text to natural speech.

```http
POST /v1/tts
```

#### Request Body

```json
{
  "text": "Hello, this is a test of text to speech.",
  "voice": "af_bella"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to convert to speech |
| `voice` | string | No | Voice model (default: "af_bella") |

#### Response

Returns audio data in WAV format with `Content-Type: audio/wav`.

#### Example

```bash
curl -X POST https://cxmpute.cloud/api/v1/tts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to Cxmpute!",
    "voice": "af_bella"
  }' \
  --output speech.wav
```

### Web Scraping

Extract content from web pages.

```http
POST /v1/scrape
```

#### Request Body

```json
{
  "urls": ["https://example.com"],
  "format": "markdown"
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | array | Yes | Array of URLs to scrape |
| `format` | string | No | Output format: "markdown", "text", "html" |

#### Response

```json
{
  "results": [{
    "url": "https://example.com",
    "content": "# Example Page\n\nThis is the content...",
    "success": true,
    "metadata": {
      "title": "Example Page",
      "description": "An example webpage"
    }
  }]
}
```

#### Example

```bash
curl -X POST https://cxmpute.cloud/api/v1/scrape \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://docs.cxmpute.cloud"],
    "format": "markdown"
  }'
```

## OpenAI Compatibility

Our `/v1/chat/completions` endpoint is fully **OpenAI-compatible**! You can use existing OpenAI libraries by simply changing the base URL:

### Python (OpenAI Library)

```python
import openai

client = openai.OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://cxmpute.cloud/api/v1",
    default_headers={"X-User-Id": "YOUR_USER_ID"}
)

response = client.chat.completions.create(
    model="llama3.1:8b",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)
```

### JavaScript

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'https://cxmpute.cloud/api/v1',
  defaultHeaders: {
    'X-User-Id': 'YOUR_USER_ID'
  }
});

const completion = await openai.chat.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'llama3.1:8b',
});
```

## Model Catalog

Explore our full model list at [cxmpute.cloud/models](https://cxmpute.cloud/models).

Popular models include:
- **llama3.1:8b** - Fast, capable general-purpose model
- **llama3.1:70b** - Larger model for complex tasks
- **nomic-embed-text** - High-quality text embeddings
- **codellama:13b** - Specialized for code generation

Visit specific model pages in our catalog to see their request formats and capabilities.

## Testnet & Rewards

🎉 **During our testnet phase, all services are currently free!** You also earn rewards based on usage and referrals.

[Learn more about our rewards program →](/docs/rewards)

## Error Handling

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid API key)
- `429` - Rate Limited
- `503` - Service Unavailable (no healthy providers)
- `500` - Internal Server Error

### Error Response Format

```json
{
  "error": "Error description"
}
```

### Common Errors

**Invalid API Key:**
```json
{
  "error": "Invalid API key"
}
```

**Missing Model:**
```json
{
  "error": "Missing required parameter: model or messages"
}
```

**No Providers Available:**
```json
{
  "error": "No provisions available for the requested model"
}
```

## Rate Limits

During testnet, there are no strict rate limits. However, fair usage policies apply to ensure service availability for all users.

## Support

Need help? We're here for you:

- **Discord**: Join our [community](https://discord.com/invite/CJGA7B2zKT) for real-time support
- **Email**: Contact [support@cxmpute.cloud](https://tally.so/r/w4DvLA)
- **GitHub**: Report issues on our [repository](https://github.com/unxversal/cxmpute-core)

## Next Steps

- [Explore specific services](/docs) for detailed guides
- [Learn about becoming a provider](/docs/provider) 
- [Join our Discord](https://discord.com/invite/CJGA7B2zKT) for the latest news
- [Check out our model catalog](https://cxmpute.cloud/models) 