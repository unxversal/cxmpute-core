# Text-to-Speech

Convert text to natural, high-quality speech using Cxmpute's distributed text-to-speech service.

## Overview

Cxmpute's Text-to-Speech (TTS) service transforms written text into lifelike audio using advanced voice synthesis models. Our global network of providers ensures fast generation times and high availability.

### Key Features

- **High-Quality Audio**: Professional-grade voice synthesis
- **Multiple Voices**: Various voice models and styles
- **Fast Generation**: Optimized for speed and reliability
- **Global Network**: Low-latency access worldwide
- **Simple API**: Easy integration with any application

## Quick Start

### Basic Request

```bash
curl -X POST https://api.cxmpute.cloud/v1/tts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to Cxmpute! This is a demonstration of our text-to-speech service.",
    "voice": "af_bella"
  }' \
  --output welcome.wav
```

### Python Example

```python
import requests

url = "https://api.cxmpute.cloud/v1/tts"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "X-User-Id": "YOUR_USER_ID",
    "Content-Type": "application/json"
}

data = {
    "text": "Hello from Cxmpute!",
    "voice": "af_bella"
}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    with open("output.wav", "wb") as f:
        f.write(response.content)
    print("Audio saved as output.wav")
else:
    print(f"Error: {response.status_code}")
```

### JavaScript Example

```javascript
const fs = require('fs');

async function generateSpeech() {
  const response = await fetch('https://api.cxmpute.cloud/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'X-User-Id': 'YOUR_USER_ID',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: 'This is generated using Cxmpute TTS!',
      voice: 'af_bella'
    })
  });

  if (response.ok) {
    const buffer = await response.arrayBuffer();
    fs.writeFileSync('speech.wav', Buffer.from(buffer));
    console.log('Audio saved as speech.wav');
  } else {
    console.error('Error:', response.status);
  }
}

generateSpeech();
```

## API Reference

### Endpoint

```http
POST /v1/tts
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | Text to convert to speech (max 10,000 characters) |
| `voice` | string | No | Voice model to use (default: "af_bella") |

### Available Voices

| Voice | Description | Language | Style |
|-------|-------------|----------|-------|
| `af_bella` | Warm, professional female voice | English | Clear, pleasant |
| `af_nicole` | Energetic female voice | English | Upbeat, dynamic |
| `af_sarah` | Calm, soothing female voice | English | Gentle, relaxed |
| `am_adam` | Professional male voice | English | Authoritative, clear |
| `am_michael` | Friendly male voice | English | Warm, approachable |

*More voices are continuously being added to our network.*

### Response

The endpoint returns raw audio data in WAV format:

- **Content-Type**: `audio/wav`
- **Format**: 16-bit PCM WAV
- **Sample Rate**: 22,050 Hz
- **Channels**: Mono

### Error Responses

```json
{
  "error": "Missing 'text' field."
}
```

Common error codes:
- `400`: Bad request (missing text, text too long)
- `401`: Unauthorized (invalid API key)
- `503`: Service unavailable (no TTS providers online)
- `500`: Internal server error

## Use Cases

### 1. **Content Creation**

Generate voiceovers for videos, podcasts, and presentations:

```python
def create_voiceover(script_segments):
    audio_files = []
    
    for i, text in enumerate(script_segments):
        response = requests.post(
            "https://api.cxmpute.cloud/v1/tts",
            headers=headers,
            json={"text": text, "voice": "af_bella"}
        )
        
        filename = f"segment_{i}.wav"
        with open(filename, "wb") as f:
            f.write(response.content)
        audio_files.append(filename)
    
    return audio_files
```

### 2. **Accessibility Features**

Add screen reading capabilities to applications:

```javascript
async function speakText(text) {
  const audio = await generateSpeech(text);
  const audioUrl = URL.createObjectURL(new Blob([audio]));
  const audioElement = new Audio(audioUrl);
  audioElement.play();
}

// Usage
document.addEventListener('click', (e) => {
  if (e.target.dataset.speak) {
    speakText(e.target.textContent);
  }
});
```

### 3. **Language Learning**

Create pronunciation examples for educational apps:

```python
def create_pronunciation_guide(phrases):
    for phrase in phrases:
        # Generate audio for the phrase
        audio_response = requests.post(
            "https://api.cxmpute.cloud/v1/tts",
            headers=headers,
            json={
                "text": phrase["text"],
                "voice": "af_sarah"  # Clear, educational voice
            }
        )
        
        # Save with metadata
        filename = f"pronunciation_{phrase['id']}.wav"
        with open(filename, "wb") as f:
            f.write(audio_response.content)
```

### 4. **Interactive Applications**

Add voice responses to chatbots and virtual assistants:

```python
def voice_assistant_response(user_message):
    # Get AI response
    chat_response = requests.post(
        "https://api.cxmpute.cloud/v1/chat/completions",
        headers=headers,
        json={
            "model": "llama3.1:8b",
            "messages": [{"role": "user", "content": user_message}]
        }
    )
    
    ai_text = chat_response.json()["choices"][0]["message"]["content"]
    
    # Convert to speech
    tts_response = requests.post(
        "https://api.cxmpute.cloud/v1/tts",
        headers=headers,
        json={"text": ai_text, "voice": "af_nicole"}
    )
    
    return tts_response.content
```

### 5. **Notification Systems**

Create audio alerts and announcements:

```python
def create_audio_notification(message, urgency="normal"):
    voice_map = {
        "normal": "af_bella",
        "urgent": "am_adam",
        "calm": "af_sarah"
    }
    
    response = requests.post(
        "https://api.cxmpute.cloud/v1/tts",
        headers=headers,
        json={
            "text": message,
            "voice": voice_map.get(urgency, "af_bella")
        }
    )
    
    return response.content
```

## Advanced Usage

### Batch Processing

Generate multiple audio files efficiently:

```python
import concurrent.futures
import requests

def generate_single_audio(text_item):
    response = requests.post(
        "https://api.cxmpute.cloud/v1/tts",
        headers=headers,
        json={
            "text": text_item["text"],
            "voice": text_item.get("voice", "af_bella")
        }
    )
    
    return {
        "id": text_item["id"],
        "audio": response.content if response.ok else None,
        "error": None if response.ok else response.text
    }

def batch_generate_audio(text_items, max_workers=5):
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(generate_single_audio, text_items))
    
    return results

# Usage
texts = [
    {"id": "intro", "text": "Welcome to our service!", "voice": "af_bella"},
    {"id": "guide", "text": "Here's how to get started...", "voice": "af_sarah"},
    {"id": "thanks", "text": "Thank you for using our app!", "voice": "af_nicole"}
]

results = batch_generate_audio(texts)
for result in results:
    if result["audio"]:
        with open(f"{result['id']}.wav", "wb") as f:
            f.write(result["audio"])
```

### Error Handling

Robust error handling for production applications:

```python
import time
import logging

def reliable_tts_request(text, voice="af_bella", max_retries=3):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "X-User-Id": USER_ID,
        "Content-Type": "application/json"
    }
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                "https://api.cxmpute.cloud/v1/tts",
                headers=headers,
                json={"text": text, "voice": voice},
                timeout=30
            )
            
            if response.status_code == 200:
                return response.content
            elif response.status_code == 503:
                # No providers available, wait and retry
                logging.warning(f"No TTS providers available, attempt {attempt + 1}")
                time.sleep(2 ** attempt)  # Exponential backoff
                continue
            else:
                response.raise_for_status()
                
        except requests.exceptions.RequestException as e:
            logging.error(f"TTS request failed: {e}")
            if attempt == max_retries - 1:
                raise
            time.sleep(1)
    
    raise Exception("TTS request failed after all retries")
```

### Streaming Integration

For real-time applications, combine with streaming text generation:

```python
async def streaming_tts_response(prompt):
    """Generate text and immediately convert to speech"""
    
    # Stream text response
    text_response = requests.post(
        "https://api.cxmpute.cloud/v1/chat/completions",
        headers=headers,
        json={
            "model": "llama3.1:8b",
            "messages": [{"role": "user", "content": prompt}],
            "stream": True
        },
        stream=True
    )
    
    accumulated_text = ""
    sentences = []
    
    for line in text_response.iter_lines():
        if line.startswith(b"data: "):
            try:
                data = json.loads(line[6:])
                if "choices" in data and data["choices"]:
                    content = data["choices"][0].get("delta", {}).get("content", "")
                    accumulated_text += content
                    
                    # Check for sentence boundaries
                    if any(punct in content for punct in ['.', '!', '?']):
                        # Extract complete sentences
                        new_sentences = extract_sentences(accumulated_text)
                        for sentence in new_sentences[len(sentences):]:
                            # Generate TTS for each complete sentence
                            audio = generate_tts(sentence)
                            yield audio
                        sentences = new_sentences
                        
            except json.JSONDecodeError:
                continue
```

## Best Practices

### 1. **Text Optimization**

Prepare text for optimal speech generation:

```python
import re

def optimize_text_for_tts(text):
    # Expand abbreviations
    abbreviations = {
        "Mr.": "Mister",
        "Dr.": "Doctor",
        "Inc.": "Incorporated",
        "Ltd.": "Limited",
        "etc.": "et cetera",
        "e.g.": "for example",
        "i.e.": "that is"
    }
    
    for abbr, expansion in abbreviations.items():
        text = text.replace(abbr, expansion)
    
    # Handle numbers
    text = re.sub(r'\b(\d+)\b', lambda m: num_to_words(int(m.group(1))), text)
    
    # Clean up extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def num_to_words(n):
    # Simple number to words conversion
    ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]
    teens = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]
    tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]
    
    if n < 10:
        return ones[n]
    elif n < 20:
        return teens[n-10]
    elif n < 100:
        return tens[n//10] + ("" if n%10 == 0 else " " + ones[n%10])
    # Add more cases as needed
    else:
        return str(n)  # Fallback to digit representation
```

### 2. **Voice Selection**

Choose appropriate voices for different contexts:

```python
def select_voice_for_content(content_type, target_audience="general"):
    voice_map = {
        ("educational", "children"): "af_sarah",
        ("educational", "adults"): "af_bella",
        ("commercial", "general"): "af_nicole",
        ("technical", "general"): "am_adam",
        ("announcement", "general"): "am_michael",
        ("storytelling", "children"): "af_sarah",
        ("news", "general"): "am_adam"
    }
    
    return voice_map.get((content_type, target_audience), "af_bella")

# Usage
voice = select_voice_for_content("educational", "adults")
```

### 3. **Caching Strategy**

Implement intelligent caching for repeated content:

```python
import hashlib
import os

class TTSCache:
    def __init__(self, cache_dir="tts_cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
    
    def get_cache_key(self, text, voice):
        content = f"{text}:{voice}"
        return hashlib.md5(content.encode()).hexdigest()
    
    def get_cached_audio(self, text, voice):
        cache_key = self.get_cache_key(text, voice)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.wav")
        
        if os.path.exists(cache_file):
            with open(cache_file, "rb") as f:
                return f.read()
        return None
    
    def cache_audio(self, text, voice, audio_data):
        cache_key = self.get_cache_key(text, voice)
        cache_file = os.path.join(self.cache_dir, f"{cache_key}.wav")
        
        with open(cache_file, "wb") as f:
            f.write(audio_data)
    
    def generate_or_get_cached(self, text, voice="af_bella"):
        # Check cache first
        cached_audio = self.get_cached_audio(text, voice)
        if cached_audio:
            return cached_audio
        
        # Generate new audio
        response = requests.post(
            "https://api.cxmpute.cloud/v1/tts",
            headers=headers,
            json={"text": text, "voice": voice}
        )
        
        if response.ok:
            audio_data = response.content
            self.cache_audio(text, voice, audio_data)
            return audio_data
        
        raise Exception(f"TTS generation failed: {response.status_code}")

# Usage
tts_cache = TTSCache()
audio = tts_cache.generate_or_get_cached("Welcome to our service!", "af_bella")
```

## Pricing

During our **testnet phase**, all services are completely **free** for all users! Pricing for the mainnet launch is **to be determined (TBD)**.

Join our [Discord community](https://discord.com/invite/CJGA7B2zKT) to stay updated on pricing announcements, give feedback, and connect with other developers building with Cxmpute.

## Support & Community

- **Discord**: Join our [community](https://discord.com/invite/CJGA7B2zKT) for TTS tips and support
- **Documentation**: [Complete API reference](/docs/user)
- **Examples**: Find more examples in our [GitHub repository](https://github.com/unxversal/cxmpute-core)

---

**Ready to add voice to your applications?** Start with our simple API and create engaging audio experiences for your users! 