# Advanced LLMs

Explore advanced capabilities of Cxmpute's large language models including thinking models, vision understanding, structured outputs, and specialized coding models.

## Overview

Cxmpute provides access to cutting-edge language models with advanced features that go beyond basic text generation:

### Advanced Capabilities

- **Thinking Models**: Models with visible reasoning processes
- **Vision Capabilities**: Analyze images and visual content  
- **Structured Outputs**: Reliable JSON and schema-based responses
- **Code Generation**: Specialized models optimized for programming tasks

## Thinking Models

Advanced reasoning models that show their step-by-step thought process, leading to more accurate and transparent results.

### Available Thinking Models

- ✅ **DeepSeek-R1** (1.5B, 7B, 8B, 14B, 32B, 70B) - Open reasoning models with performance approaching leading models
- ✅ **Qwen 3** (4B, 8B, 14B, 30B, 32B) - Latest generation with comprehensive reasoning capabilities

### Enable Thinking Mode

```python
import requests

headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "X-User-Id": "your_user_id",
    "Content-Type": "application/json"
}

response = requests.post(
    "https://cxmpute.cloud/api/v1/chat/completions",
    headers=headers,
    json={
        "model": "deepseek-r1:8b",
        "messages": [
            {"role": "user", "content": "How many r's are in the word strawberry? Think step by step."}
        ],
        "think": True
    }
)

result = response.json()
message = result["choices"][0]["message"]

print("Thinking Process:")
print(message.get("thinking", ""))
print("\nFinal Answer:")
print(message["content"])
```

### When to Use Thinking Models

**Best for:**
- Complex reasoning tasks
- Mathematical problems
- Multi-step analysis
- Debugging logical issues
- Academic research questions

**Trade-offs:**
- **With Thinking**: More accurate, transparent reasoning, slower response
- **Without Thinking**: Faster responses, direct answers, less transparency

### Thinking Model Comparison

```python
def compare_thinking_models(question):
    """Compare different thinking models on the same question"""
    
    models = ["deepseek-r1:8b", "deepseek-r1:32b", "qwen3:8b"]
    results = {}
    
    for model in models:
        response = requests.post(
            "https://cxmpute.cloud/api/v1/chat/completions",
            headers=headers,
            json={
                "model": model,
                "messages": [{"role": "user", "content": question}],
                "think": True
            }
        )
        
        result = response.json()
        message = result["choices"][0]["message"]
        
        results[model] = {
            "thinking": message.get("thinking", ""),
            "answer": message["content"]
        }
    
    return results

# Usage
question = "If a train travels 120 km in 90 minutes, what is its average speed in km/h?"
comparisons = compare_thinking_models(question)

for model, result in comparisons.items():
    print(f"\n=== {model} ===")
    print("Thinking:", result["thinking"][:200] + "...")
    print("Answer:", result["answer"])
```

## Vision Models

Analyze images, charts, diagrams, and visual content with multimodal models that understand both text and images.

### Available Vision Models

- ✅ **Gemma 3** (1B, 4B, 12B, 24B) - Capable vision-language model
- ✅ **Llama 3.2 Vision** (11B) - Instruction-tuned image reasoning
- ✅ **Qwen 2.5 VL** (3B, 7B, 32B, 72B) - Flagship vision-language model
- ✅ **Mistral Small 3.1** (24B) - Vision + tool calling + 128k context
- ✅ **Granite 3.2 Vision** (2B) - Document understanding specialist
- ✅ **MiniCPM-V** (8B) - Efficient multimodal understanding
- ✅ **LLaVA-Llama3** (8B) - LLaVA fine-tuned from Llama 3
- ✅ **Moondream** (1.8B) - Lightweight edge-optimized vision model

### Image Analysis

```python
import base64

def encode_image(image_path):
    """Convert image to base64 for API"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def analyze_image(image_path, question, model="llama3.2-vision:11b"):
    """Analyze an image with a vision model"""
    
    image_base64 = encode_image(image_path)
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": question},
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

# Usage examples
result = analyze_image("chart.png", "What trends do you see in this sales chart?")
print(result)

result = analyze_image("document.jpg", "Extract all the text from this document", "granite3.2-vision")
print(result)
```

### Vision Use Cases

#### 1. Document Processing
```python
def extract_document_data(image_path):
    """Extract structured data from documents using Granite 3.2 Vision"""
    return analyze_image(
        image_path,
        "Extract all text, tables, and structured data from this document. Format as JSON.",
        "granite3.2-vision"
    )
```

#### 2. Chart Analysis
```python
def analyze_chart(image_path):
    """Analyze charts and graphs"""
    return analyze_image(
        image_path,
        "Analyze this chart. Describe the trends, key insights, and data points.",
        "qwen2.5vl:7b"
    )
```

#### 3. Visual Question Answering
```python
def visual_qa(image_path, question):
    """Answer questions about images"""
    return analyze_image(
        image_path,
        f"Answer this question about the image: {question}",
        "llama3.2-vision:11b"
    )
```

#### 4. Multi-Image Comparison
```python
def compare_images(image_paths, comparison_question):
    """Compare multiple images"""
    
    content = [{"type": "text", "text": comparison_question}]
    
    for i, image_path in enumerate(image_paths):
        image_base64 = encode_image(image_path)
        content.append({
            "type": "text", 
            "text": f"Image {i+1}:"
        })
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
        })
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "qwen2.5vl:32b",
            "messages": [{"role": "user", "content": content}]
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]
```

## Structured Outputs & Tool Use

Models that can reliably generate JSON responses and call functions for complex workflows.

### Tool-Capable Models

All models from our [tool calling documentation](/docs/tool-use-json):

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

### Structured JSON Output

```python
def get_structured_analysis(text, model="qwen3:8b"):
    """Get structured analysis in JSON format"""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {
                    "role": "user", 
                    "content": f"""Analyze this text and respond with valid JSON only:

Text: {text}

Required JSON structure:
{{
    "sentiment": "positive|negative|neutral",
    "key_topics": ["topic1", "topic2"],
    "summary": "brief summary",
    "confidence": 0.0-1.0,
    "entities": {{
        "people": ["name1", "name2"],
        "organizations": ["org1", "org2"],
        "locations": ["loc1", "loc2"]
    }}
}}"""
                }
            ],
            "response_format": {"type": "json_object"}
        }
    )
    
    return json.loads(response.json()["choices"][0]["message"]["content"])
```

### Function Calling

```python
def create_data_analysis_tool():
    """Example tool for data analysis"""
    
    tools = [
        {
            "type": "function",
            "function": {
                "name": "analyze_data",
                "description": "Analyze numerical data and generate insights",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "data": {
                            "type": "array",
                            "items": {"type": "number"},
                            "description": "Array of numerical values"
                        },
                        "analysis_type": {
                            "type": "string",
                            "enum": ["trend", "statistics", "correlation"],
                            "description": "Type of analysis to perform"
                        }
                    },
                    "required": ["data", "analysis_type"]
                }
            }
        }
    ]
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "qwen3:14b",
            "messages": [
                {"role": "user", "content": "Analyze this sales data: [100, 120, 115, 140, 160, 180, 200]"}
            ],
            "tools": tools
        }
    )
    
    result = response.json()
    message = result["choices"][0]["message"]
    
    if message.get("tool_calls"):
        tool_call = message["tool_calls"][0]
        function_name = tool_call["function"]["name"]
        function_args = json.loads(tool_call["function"]["arguments"])
        
        print(f"Model wants to call: {function_name}")
        print(f"With arguments: {function_args}")
        
        # Here you would execute the actual function
        # and return the result back to the model
    
    return result
```

## Code Generation Models

Specialized models optimized for programming tasks, code generation, and software development.

### Available Code Models

- ✅ **Qwen 2.5 Coder** (3B, 7B, 14B, 32B) - Latest code-specific models
- ✅ **DeepSeek Coder** (1.3B, 6.7B) - Efficient coding models
- ✅ **DeepSeek Coder V2** (16B) - Advanced coding with reasoning
- ✅ **DeepCoder** (14B) - Specialized deep coding model
- ✅ **CodeGemma** (2B, 7B) - Google's code generation models

### Code Generation

```python
def generate_code(task, language="python", model="qwen2.5-coder:7b"):
    """Generate code for specific programming tasks"""
    
    prompt = f"""
Task: {task}
Language: {language}

Requirements:
- Write clean, well-commented code
- Include error handling where appropriate
- Provide usage examples
- Follow best practices for {language}
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

# Usage examples
api_code = generate_code("Create a REST API endpoint for user authentication using Flask")
print(api_code)

algorithm_code = generate_code("Implement a binary search algorithm", "python", "deepseek-coder:6.7b")
print(algorithm_code)
```

### Code Review and Debugging

```python
def review_code(code, model="qwen2.5-coder:14b"):
    """Review code for bugs and improvements"""
    
    prompt = f"""
Please review this code and provide:
1. Bug identification
2. Security vulnerabilities
3. Performance improvements
4. Best practice recommendations
5. Refactored version if needed

Code to review:
```
{code}
```
"""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}]
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]

def explain_code(code, model="deepseek-coder-v2:16b"):
    """Explain complex code snippets"""
    
    prompt = f"""
Explain this code in detail:
1. What it does
2. How it works
3. Key algorithms or patterns used
4. Potential use cases

Code:
```
{code}
```
"""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}]
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]
```

### Multi-Language Code Generation

```python
def generate_multilang_solution(problem, languages=["python", "javascript", "rust"]):
    """Generate solutions in multiple programming languages"""
    
    solutions = {}
    
    for lang in languages:
        # Choose optimal model for each language
        if lang in ["python", "javascript"]:
            model = "qwen2.5-coder:7b"
        elif lang in ["rust", "c++", "go"]:
            model = "deepseek-coder-v2:16b"
        else:
            model = "codegemma:7b"
        
        code = generate_code(problem, lang, model)
        solutions[lang] = code
    
    return solutions

# Usage
problem = "Implement a function to find the longest common subsequence between two strings"
solutions = generate_multilang_solution(problem)

for lang, code in solutions.items():
    print(f"\n=== {lang.upper()} ===")
    print(code[:300] + "...")
```

### Code Completion

Complete partially written code with intelligent suggestions and context awareness.

```python
def complete_code(partial_code, language="python", model="qwen2.5-coder:14b"):
    """Complete partially written code"""
    
    prompt = f"""Complete this {language} code. Only provide the completion, not the entire code:

```{language}
{partial_code}
```

Complete the code from where it left off. Provide clean, efficient completion that follows best practices."""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,  # Very low temperature for consistent completions
            "max_tokens": 500
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]

def complete_function(function_signature, description="", model="deepseek-coder:6.7b"):
    """Complete a function based on its signature and description"""
    
    prompt = f"""Complete this function implementation:

{function_signature}
    # {description}
    
Provide only the function body (implementation inside the function)."""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]

# Usage Examples

# 1. Complete a loop
partial_loop = """
data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
result = []
for item in data:
    if item % 2 == 0:
"""

completion = complete_code(partial_loop, "python")
print("Completed code:")
print(partial_loop + completion)

# 2. Complete a function
function_sig = """
def binary_search(arr, target):
"""

function_body = complete_function(
    function_sig, 
    "Implement binary search algorithm to find target in sorted array"
)
print("Completed function:")
print(function_sig + function_body)

# 3. Complete class method
partial_class = """
class DataProcessor:
    def __init__(self, data):
        self.data = data
    
    def filter_data(self, condition_func):
        filtered = []
        for item in self.data:
"""

completion = complete_code(partial_class, "python", "qwen2.5-coder:32b")
print("Completed class method:")
print(partial_class + completion)

# 4. Complete error handling
partial_error = """
def safe_divide(a, b):
    try:
        result = a / b
"""

completion = complete_code(partial_error, "python")
print("Completed with error handling:")
print(partial_error + completion)
```

### Interactive Code Completion

```python
def interactive_completion_session(model="qwen2.5-coder:14b"):
    """Interactive code completion session"""
    
    print("=== Interactive Code Completion ===")
    print("Type your code and press Enter twice to get completion.")
    print("Type 'exit' to quit.\n")
    
    while True:
        print("Enter your partial code:")
        lines = []
        while True:
            line = input()
            if line == "exit":
                return
            if line == "" and lines:  # Empty line after content
                break
            lines.append(line)
        
        if not lines:
            continue
            
        partial_code = "\n".join(lines)
        
        # Detect language based on syntax hints
        language = "python"  # Default
        if "function" in partial_code or "=>" in partial_code:
            language = "javascript"
        elif "fn " in partial_code or "let mut" in partial_code:
            language = "rust"
        elif "#include" in partial_code or "std::" in partial_code:
            language = "cpp"
        
        print(f"\nDetected language: {language}")
        print("Completing...")
        
        try:
            completion = complete_code(partial_code, language, model)
            print(f"\n--- Completion ---")
            print(completion)
            print(f"\n--- Full Code ---")
            print(partial_code + completion)
            print("=" * 50)
        except Exception as e:
            print(f"Error: {e}")

# Usage
# interactive_completion_session()
```

### Context-Aware Completion

```python
def context_aware_completion(code_context, partial_code, model="deepseek-coder-v2:16b"):
    """Complete code with additional context from the codebase"""
    
    prompt = f"""Given this codebase context:

{code_context}

Complete this partial code:
```
{partial_code}
```

Consider the existing code structure, naming conventions, and patterns used in the context."""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.15
        }
    )
    
    return response.json()["choices"][0]["message"]["content"]

# Example with context
codebase_context = """
class APIClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
    
    def _make_request(self, method, endpoint, **kwargs):
        url = f"{self.base_url}/{endpoint}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        return self.session.request(method, url, headers=headers, **kwargs)
    
    def get_user(self, user_id):
        return self._make_request("GET", f"users/{user_id}")
"""

partial_new_method = """
    def create_user(self, user_data):
"""

completion = context_aware_completion(codebase_context, partial_new_method)
print("Context-aware completion:")
print(partial_new_method + completion)
```

## Advanced Use Cases

### 1. Multi-Modal Code Analysis

Combine vision and code models to analyze code screenshots or diagrams:

```python
def analyze_code_screenshot(image_path, model="granite3.2-vision"):
    """Extract and analyze code from screenshots"""
    
    extracted_code = analyze_image(
        image_path,
        "Extract all code from this screenshot. Preserve formatting and syntax.",
        model
    )
    
    # Then analyze with code model
    review = review_code(extracted_code, "qwen2.5-coder:14b")
    
    return {
        "extracted_code": extracted_code,
        "analysis": review
    }
```

### 2. Thinking + Vision Analysis

Combine thinking models with vision for complex visual reasoning:

```python
def deep_visual_analysis(image_path, question):
    """Perform deep visual analysis with reasoning"""
    
    image_base64 = encode_image(image_path)
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": "qwen3:14b",  # Thinking + vision capable
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"{question}\n\nThink step by step about what you see."},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                        }
                    ]
                }
            ],
            "think": True
        }
    )
    
    result = response.json()
    message = result["choices"][0]["message"]
    
    return {
        "thinking": message.get("thinking", ""),
        "analysis": message["content"]
    }
```

### 3. Structured Code Generation

Generate code with structured outputs for better integration:

```python
def generate_structured_code(requirements, model="qwen2.5-coder:14b"):
    """Generate code with structured metadata"""
    
    prompt = f"""
Generate code for: {requirements}

Respond with valid JSON containing:
{{
    "code": "the actual code",
    "language": "programming language",
    "dependencies": ["list", "of", "dependencies"],
    "complexity": "simple|medium|complex",
    "explanation": "brief explanation",
    "tests": "example test code",
    "usage_example": "how to use the code"
}}
"""
    
    response = requests.post(
        "https://cxmpute.cloud/api/v1/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"}
        }
    )
    
    return json.loads(response.json()["choices"][0]["message"]["content"])
```

## Performance Optimization

### Model Selection Guide

```python
def select_optimal_model(task_type, complexity="medium", speed_requirement="balanced"):
    """Select the best model for your specific needs"""
    
    models = {
        "thinking": {
            "simple": "deepseek-r1:1.5b",
            "medium": "deepseek-r1:8b", 
            "complex": "deepseek-r1:32b"
        },
        "vision": {
            "simple": "moondream",
            "medium": "llama3.2-vision:11b",
            "complex": "qwen2.5vl:32b"
        },
        "coding": {
            "simple": "codegemma:2b",
            "medium": "qwen2.5-coder:7b",
            "complex": "deepseek-coder-v2:16b"
        },
        "structured": {
            "simple": "qwen3:4b",
            "medium": "qwen3:14b",
            "complex": "qwen3:32b"
        }
    }
    
    if speed_requirement == "fastest":
        complexity = "simple"
    elif speed_requirement == "quality":
        complexity = "complex"
    
    return models.get(task_type, {}).get(complexity, "llama3.1:8b")

# Usage
model = select_optimal_model("vision", "complex", "quality")
print(f"Recommended model: {model}")
```

## Pricing

During our **testnet phase**, all advanced model features are completely **free** for all users! Pricing for the mainnet launch is **to be determined (TBD)**.

Join our [Discord community](https://discord.gg/vE3xvFsZA8) to stay updated on pricing announcements, give feedback, and connect with other developers building with Cxmpute.

## Support

- **Discord**: [Community support](https://discord.gg/vE3xvFsZA8)
- **Examples**: [GitHub repository](https://github.com/unxversal/cxmpute-core)

---

**Ready for advanced AI?** Explore thinking models, vision understanding, and structured outputs with Cxmpute's cutting-edge capabilities! 