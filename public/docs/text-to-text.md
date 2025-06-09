Generate human-like text responses using state-of-the-art language models through Cxmpute's distributed AI network.

## Overview

Cxmpute's Text-to-Text service provides access to powerful large language models (LLMs) for chat completions, text generation, and conversational AI. Our **OpenAI-compatible API** makes it easy to integrate with existing applications.

### Key Features

- **OpenAI Compatibility**: Drop-in replacement for OpenAI's chat completions API
- **Multiple Models**: Access to dozens of popular LLMs
- **Streaming Support**: Real-time response generation
- **Global Network**: Low-latency access through distributed providers
- **Advanced Features**: Tool calling, JSON mode, and custom formats

## Quick Start

### Basic Chat Completion

```bash
curl -X POST https://cxmpute.cloud/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [
      {"role": "user", "content": "Explain quantum computing in simple terms."}
    ]
  }'
```

### Python Example

```python
import requests

url = "https://cxmpute.cloud/api/v1/chat/completions"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "X-User-Id": "YOUR_USER_ID",
    "Content-Type": "application/json"
}

data = {
    "model": "llama3.1:8b",
    "messages": [
        {"role": "user", "content": "Write a short story about AI and humanity."}
    ],
    "temperature": 0.7,
    "max_tokens": 500
}

response = requests.post(url, headers=headers, json=data)
result = response.json()

print(result["choices"][0]["message"]["content"])
```

### Using OpenAI Library

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
        {"role": "system", "content": "You are a helpful AI assistant."},
        {"role": "user", "content": "What are the benefits of renewable energy?"}
    ]
)

print(response.choices[0].message.content)
```

## API Reference

### Endpoint

```http
POST /v1/chat/completions
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `model` | string | Yes | Model name (see available models) |
| `messages` | array | Yes | Array of message objects |
| `stream` | boolean | No | Enable streaming responses (default: false) |
| `temperature` | number | No | Sampling temperature 0-2 (default: 0.7) |
| `max_tokens` | number | No | Maximum tokens to generate |
| `top_p` | number | No | Nucleus sampling parameter (0-1) |
| `response_format` | object | No | Response format specification |
| `tools` | array | No | Available tools for function calling |

### Available Models

| Model | Size | Description | Best For |
|-------|------|-------------|----------|
| `llama3.1:8b` | 8B | Fast, general-purpose | Most applications |
| `llama3.1:70b` | 70B | High-quality responses | Complex reasoning |
| `codellama:13b` | 13B | Code generation | Programming tasks |
| `mixtral:8x7b` | 8x7B | Mixture of experts | Specialized tasks |
| `qwen2.5:14b` | 14B | Balanced performance | General use |

*See our full [model catalog](https://cxmpute.cloud/models) for more options.*

## Streaming Responses

### Enable Streaming

```python
import requests
import json

def stream_chat_completion(messages, model="llama3.1:8b"):
    url = "https://cxmpute.cloud/api/v1/chat/completions"
    headers = {
        "Authorization": "Bearer YOUR_API_KEY",
        "X-User-Id": "YOUR_USER_ID",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": model,
        "messages": messages,
        "stream": True
    }
    
    response = requests.post(url, headers=headers, json=data, stream=True)
    
    for line in response.iter_lines():
        if line.startswith(b"data: "):
            chunk = line[6:]  # Remove "data: " prefix
            if chunk == b"[DONE]":
                break
            
            try:
                data = json.loads(chunk)
                if "choices" in data and data["choices"]:
                    delta = data["choices"][0].get("delta", {})
                    if "content" in delta:
                        yield delta["content"]
            except json.JSONDecodeError:
                continue

# Usage
messages = [{"role": "user", "content": "Write a poem about the ocean."}]
for chunk in stream_chat_completion(messages):
    print(chunk, end="", flush=True)
```

## Use Cases

### 1. Chatbot Development

Build conversational AI applications:

```python
class ChatBot:
    def __init__(self, system_prompt="You are a helpful assistant."):
        self.conversation_history = [
            {"role": "system", "content": system_prompt}
        ]
    
    def chat(self, user_message):
        self.conversation_history.append({
            "role": "user", 
            "content": user_message
        })
        
        response = requests.post(
            "https://cxmpute.cloud/api/v1/chat/completions",
            headers=headers,
            json={
                "model": "llama3.1:8b",
                "messages": self.conversation_history,
                "temperature": 0.7
            }
        )
        
        ai_response = response.json()["choices"][0]["message"]["content"]
        
        self.conversation_history.append({
            "role": "assistant",
            "content": ai_response
        })
        
        return ai_response

# Usage
bot = ChatBot("You are a friendly coding assistant.")
response = bot.chat("How do I reverse a string in Python?")
print(response)
```

### 2. Content Generation

Generate blog posts, articles, and marketing content:

```python
def generate_blog_post(topic, tone="professional", length="medium"):
    length_map = {
        "short": "Write a concise 300-word blog post",
        "medium": "Write a comprehensive 800-word blog post", 
        "long": "Write a detailed 1500-word blog post"
    }
    
    prompt = f"""
    {length_map[length]} about {topic}.
    Tone: {tone}
    Include:
    - Engaging introduction
    - Clear main points with examples
    - Actionable takeaways
    - Compelling conclusion
    """
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "llama3.1:70b",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.8,
            "max_tokens": 2000
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]

# Usage
article = generate_blog_post("sustainable energy solutions", "informative", "medium")
print(article)
```

### 3. Code Generation

Generate and explain code:

```python
def code_assistant(task, language="python"):
    prompt = f"""
    Task: {task}
    Language: {language}
    
    Please provide:
    1. Clean, well-commented code
    2. Explanation of how it works
    3. Example usage
    4. Best practices
    """
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "codellama:13b",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]

# Usage
code_help = code_assistant("Create a REST API endpoint for user authentication using Flask")
print(code_help)
```

## Best Practices

### 1. Temperature Control

Adjust response creativity:

```python
def generate_with_creativity(prompt, creativity_level="balanced"):
    temperature_map = {
        "factual": 0.1,      # Very consistent, factual responses
        "balanced": 0.7,     # Good balance of accuracy and creativity
        "creative": 1.2,     # More creative and diverse responses
    }
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "llama3.1:8b",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature_map[creativity_level]
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]
```

### 2. Error Handling

Implement robust error handling:

```python
import time
import random

def resilient_chat_completion(messages, model="llama3.1:8b", max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "https://cxmpute.cloud/api/v1/chat/completions",
                headers=headers,
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.7
                },
                timeout=60
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 503:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                time.sleep(wait_time)
                continue
            else:
                response.raise_for_status()
                
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise e
            time.sleep(1)
    
    raise Exception("Failed to get response after all retries")
```

## Pricing

During our **testnet phase**, all services are completely **free** for all users! Pricing for the mainnet launch is **to be determined (TBD)**.

Join our [Discord community](https://discord.gg/vE3xvFsZA8) to stay updated on pricing announcements, give feedback, and connect with other developers building with Cxmpute.

## Support

- **Discord**: [Community support](https://discord.gg/vE3xvFsZA8)
- **Documentation**: [Complete API reference](/docs/user) 
- **Examples**: [GitHub repository](https://github.com/unxversal/cxmpute-core)
- **Model Catalog**: [Browse all available models](https://cxmpute.cloud/models)

---

**Ready to build with AI?** Start with our OpenAI-compatible API and create intelligent applications powered by the world's best language models! 