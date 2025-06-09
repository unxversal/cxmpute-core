Enable function calling and structured outputs with advanced language models.

## Overview

Cxmpute supports tool calling and structured outputs, allowing models to interact with external functions, APIs, and return data in specific JSON formats.

### Key Features

- **Function Calling**: Models can call predefined functions and tools
- **Structured Outputs**: Force models to return specific JSON schemas
- **OpenAI Compatible**: Works with existing OpenAI tool calling code
- **Multiple Models**: Available on supported models (Qwen3, Deepseek, Llama 3, etc.)

## Tool Calling

Enable models to call functions and interact with external systems.

### Basic Example

```python
import requests

# Define available tools
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "The name of the city"
                    }
                },
                "required": ["city"]
            }
        }
    }
]

data = {
    "model": "llama3.1:8b",
    "messages": [
        {"role": "user", "content": "What's the weather in New York?"}
    ],
    "tools": tools
}

response = requests.post(url, headers=headers, json=data)
result = response.json()

# Check if model wants to call a function
if result["choices"][0]["message"].get("tool_calls"):
    tool_call = result["choices"][0]["message"]["tool_calls"][0]
    function_name = tool_call["function"]["name"]
    function_args = tool_call["function"]["arguments"]
    
    print(f"Model wants to call: {function_name}")
    print(f"With arguments: {function_args}")
```

## JSON Mode

Force models to return data in specific JSON formats.

### Basic JSON Response

```python
def get_structured_response(prompt, model="llama3.1:8b"):
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "user", "content": f"{prompt}\n\nRespond with valid JSON only."}
            ],
            "response_format": {
                "type": "json_object"
            }
        }
    )
    
    return json.loads(response.json()["choices"][0]["message"]["content"])

# Usage
prompt = "Analyze this review: 'Great product, but expensive.'"
result = get_structured_response(prompt)
print(json.dumps(result, indent=2))
```

## Use Cases

### 1. Data Extraction

Extract structured information from unstructured text.

### 2. API Integration

Create tools that interact with external APIs and services.

### 3. Content Classification

Automatically classify and tag content with structured metadata.

### 4. Form Processing

Process documents and forms into structured data.

## Supported Models

Tool calling and JSON mode are available on:

- ✅ **Qwen 3** (4B, 8B, 14B, 30B, 32B) - Full tool calling support
- ✅ **Llama 3.1** (8B) - Full tool calling support
- ✅ **Llama 3.2** (1B, 3B) - Tool calling support
- ✅ **Llama 3.3** (70B) - Tool calling support
- ✅ **Qwen 2.5** (7B, 14B, 32B, 72B) - Tool calling support
- ✅ **Qwen 2.5 Coder** (3B, 7B, 14B, 32B) - Tool calling support
- ✅ **QwQ** (32B) - Reasoning with tool calling support
- ✅ **Cogito** (3B, 8B, 14B, 32B, 70B) - Tool calling support
- ✅ **Mistral** (7B) - Tool calling support
- ✅ **Mistral Nemo** (12B) - Tool calling support
- ✅ **Mistral Small 3.1** (24B) - Vision + tool calling support
- ✅ **Phi-4 Mini** (3.8B) - Tool calling support
- ✅ **Granite 3.2 Vision** (2B) - Vision + tool calling support
- 🚧 **Other models** - Basic JSON formatting

## Examples

Visit our [GitHub repository](https://github.com/unxversal/cxmpute-core) for complete examples and tutorials.

## Support

- **Discord**: [Community support](https://discord.gg/vE3xvFsZA8)
- **Examples**: [GitHub repository](https://github.com/unxversal/cxmpute-core)

---

**Ready to build intelligent applications?** Use our tool calling and structured outputs to create AI systems that can interact with the real world! 