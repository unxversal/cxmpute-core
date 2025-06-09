# Advanced LLMs

Explore advanced features and capabilities of Cxmpute's large language models for sophisticated AI applications.

## Overview

Cxmpute provides access to state-of-the-art language models with advanced features like thinking modes, structured outputs, multi-modal capabilities, and specialized model variants.

### Advanced Features

- **Thinking Models**: Models with visible reasoning processes
- **Vision Capabilities**: Analyze images and visual content
- **Structured Outputs**: Reliable JSON and schema-based responses
- **Custom Fine-tuned Models**: Specialized models for specific domains
- **Multi-turn Conversations**: Long-context conversations with memory

## Thinking Models

Some models support "thinking" mode where you can see their reasoning process.

### Models with Thinking

- **DeepSeek R1**: Advanced reasoning with visible thought process
- **Qwen 3**: Thinking-capable model with step-by-step reasoning

### Enable Thinking

```python
response = requests.post(
    "https://cxmpute.cloud/api/v1/chat/completions",
    headers=headers,
    json={
        "model": "deepseek-r1:8b",
        "messages": [
            {"role": "user", "content": "How many r's are in the word strawberry?"}
        ],
        "think": True
    }
)

result = response.json()
message = result["choices"][0]["message"]

print("Thinking:")
print(message.get("thinking", ""))
print("\nFinal Answer:")
print(message["content"])
```

### Thinking vs No Thinking

**With Thinking**: More accurate, shows reasoning, takes longer
**Without Thinking**: Faster responses, direct answers

## Vision Models

Analyze images and visual content with vision-capable models.

### Supported Models

- **Llama 3.2 Vision**: General vision understanding
- **GPT-4V Compatible**: Image analysis and description

### Image Analysis

```python
import base64

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

# Analyze an image
image_base64 = encode_image("path/to/image.jpg")

response = requests.post(
    "https://cxmpute.cloud/api/v1/chat/completions",
    headers=headers,
    json={
        "model": "llama3.2-vision",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "What do you see in this image?"},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                    }
                ]
            }
        ]
    }
)

result = response.json()
print(result["choices"][0]["message"]["content"])
```

### Vision Use Cases

- **Document Analysis**: Extract text and data from documents
- **Object Detection**: Identify objects and scenes in images
- **Chart Reading**: Analyze graphs, charts, and diagrams
- **Medical Imaging**: Analyze medical scans (with proper disclaimers)

## Code Generation Models

Specialized models optimized for programming tasks.

### CodeLlama Variants

- **CodeLlama Base**: General code generation
- **CodeLlama Instruct**: Code with natural language instructions
- **CodeLlama Python**: Python-specialized variant

### Code Generation

```python
def generate_code(task, language="python", model="codellama:13b"):
    prompt = f"""
    Task: {task}
    Language: {language}
    
    Requirements:
    - Write clean, well-commented code
    - Include error handling where appropriate
    - Provide usage examples
    - Follow best practices
    """
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2  # Lower temperature for more deterministic code
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]

# Usage
code = generate_code("Create a REST API endpoint for user authentication using Flask")
print(code)
```

## Specialized Models

Domain-specific models for particular use cases.

### Available Specialized Models

- **Medical Models**: Healthcare and medical text analysis
- **Legal Models**: Legal document analysis and drafting
- **Financial Models**: Financial analysis and reporting
- **Scientific Models**: Research paper analysis and scientific writing

### Domain-Specific Analysis

```python
def analyze_medical_text(text):
    """Analyze medical text with specialized model"""
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "medical-llama:8b",
            "messages": [
                {"role": "system", "content": "You are a medical AI assistant. Provide informative responses while emphasizing that this is not medical advice."},
                {"role": "user", "content": f"Analyze this medical text: {text}"}
            ]
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]
```

## Long Context Models

Models capable of handling very long conversations and documents.

### Context Length Capabilities

| Model | Context Length | Best For |
|-------|----------------|----------|
| Llama 3.1 70B | 128K tokens | Long documents |
| Claude-compatible | 200K tokens | Entire books |
| GPT-4 Turbo | 128K tokens | Extended conversations |

### Long Document Processing

```python
def process_long_document(document_text, query):
    """Process long documents with high-context models"""
    
    # Estimate tokens (rough: 4 chars per token)
    estimated_tokens = len(document_text) // 4
    
    if estimated_tokens > 100000:
        model = "llama3.1:70b"  # Use larger context model
    else:
        model = "llama3.1:8b"
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "user", "content": f"Document:\n{document_text}\n\nQuery: {query}"}
            ]
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]
```

## Multi-Modal Capabilities

Advanced models that can handle multiple types of input.

### Text + Image Analysis

```python
def analyze_chart_with_context(image_base64, context_text):
    """Analyze charts and graphs with additional context"""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "llama3.2-vision",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Context: {context_text}"},
                        {"type": "text", "text": "Please analyze this chart in the context provided:"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                        }
                    ]
                }
            ]
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]
```

## Performance Optimization

Tips for getting the best performance from advanced models.

### Model Selection Strategy

```python
def select_optimal_model(task_type, quality_requirement, speed_requirement):
    """Select the best model based on requirements"""
    
    if quality_requirement == "highest":
        if task_type == "coding":
            return "codellama:34b"
        elif task_type == "reasoning":
            return "llama3.1:70b"
        else:
            return "gpt4-turbo"
    
    elif speed_requirement == "fastest":
        if task_type == "coding":
            return "codellama:7b"
        else:
            return "llama3.1:8b"
    
    else:  # Balanced
        if task_type == "coding":
            return "codellama:13b"
        elif task_type == "vision":
            return "llama3.2-vision"
        else:
            return "llama3.1:8b"

# Usage
model = select_optimal_model("reasoning", "highest", "medium")
```

### Prompt Engineering for Advanced Models

```python
def create_advanced_prompt(task, context="", examples="", constraints=""):
    """Create optimized prompts for advanced models"""
    
    prompt_parts = []
    
    if context:
        prompt_parts.append(f"Context: {context}")
    
    prompt_parts.append(f"Task: {task}")
    
    if examples:
        prompt_parts.append(f"Examples:\n{examples}")
    
    if constraints:
        prompt_parts.append(f"Constraints: {constraints}")
    
    prompt_parts.append("Please provide a comprehensive response:")
    
    return "\n\n".join(prompt_parts)

# Usage
prompt = create_advanced_prompt(
    task="Analyze the financial implications of this merger",
    context="Two tech companies in the AI space",
    constraints="Focus on market impact and technical synergies"
)
```

## Batch Processing

Process multiple requests efficiently with advanced models.

### Parallel Processing

```python
import asyncio
import aiohttp

async def process_batch_advanced(prompts, model="llama3.1:8b"):
    """Process multiple prompts in parallel"""
    
    async def single_request(session, prompt):
        async with session.post(
            "https://cxmpute.cloud/api/v1/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}]
            }
        ) as response:
            result = await response.json()
            return result["choices"][0]["message"]["content"]
    
    async with aiohttp.ClientSession() as session:
        tasks = [single_request(session, prompt) for prompt in prompts]
        results = await asyncio.gather(*tasks)
    
    return results

# Usage
prompts = [
    "Analyze the market trends in AI",
    "Explain quantum computing",
    "Write a Python function for data analysis"
]

# results = asyncio.run(process_batch_advanced(prompts))
```

## Error Handling & Reliability

Robust error handling for advanced model features.

### Fallback Strategy

```python
def robust_model_request(prompt, preferred_models, max_retries=3):
    """Try multiple models with fallback strategy"""
    
    for model in preferred_models:
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    "https://cxmpute.cloud/api/v1/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "timeout": 60
                    }
                )
                
                if response.status_code == 200:
                    return response.json()["choices"][0]["message"]["content"]
                elif response.status_code == 503:
                    # Model unavailable, try next
                    break
                    
            except Exception as e:
                if attempt == max_retries - 1:
                    continue  # Try next model
                time.sleep(2 ** attempt)
    
    raise Exception("All models failed")

# Usage
models = ["llama3.1:70b", "llama3.1:8b", "mixtral:8x7b"]
result = robust_model_request("Complex reasoning task", models)
```

## Pricing for Advanced Models

During our **testnet phase**, all services are completely **free** for all users! Pricing for the mainnet launch is **to be determined (TBD)**.

Join our [Discord community](https://discord.gg/vE3xvFsZA8) to stay updated on pricing announcements, give feedback, and connect with other developers building with Cxmpute.

## Support

- **Discord**: [Community support](https://discord.gg/vE3xvFsZA8)
- **Documentation**: [Complete API reference](/docs/user)
- **Examples**: [GitHub repository](https://github.com/unxversal/cxmpute-core)

---

**Ready for advanced AI?** Explore the cutting edge of language model capabilities with Cxmpute's advanced features! 