# Web Scraping

Extract content from web pages intelligently using Cxmpute's distributed web scraping service.

## Overview

Cxmpute's Web Scraping service provides reliable content extraction from web pages with intelligent parsing, markdown conversion, and metadata extraction. Our global network of providers ensures consistent availability and bypasses common blocking mechanisms.

### Key Features

- **Intelligent Extraction**: Smart content parsing and cleaning
- **Multiple Formats**: HTML, text, and markdown output
- **Metadata Extraction**: Titles, descriptions, and structured data
- **Batch Processing**: Handle multiple URLs efficiently
- **Global Network**: Distributed scraping nodes worldwide

## Quick Start

### Basic Request

```bash
curl -X POST https://api.cxmpute.cloud/v1/scrape \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "X-User-Id: YOUR_USER_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com"],
    "format": "markdown"
  }'
```

### Python Example

```python
import requests

url = "https://api.cxmpute.cloud/v1/scrape"
headers = {
    "Authorization": "Bearer YOUR_API_KEY",
    "X-User-Id": "YOUR_USER_ID",
    "Content-Type": "application/json"
}

data = {
    "urls": ["https://docs.cxmpute.cloud"],
    "format": "markdown"
}

response = requests.post(url, headers=headers, json=data)
result = response.json()

for item in result["results"]:
    if item["success"]:
        print(f"Title: {item['metadata']['title']}")
        print(f"Content: {item['content'][:200]}...")
    else:
        print(f"Failed to scrape {item['url']}")
```

## API Reference

### Endpoint

```http
POST /v1/scrape
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `urls` | array | Yes | Array of URLs to scrape |
| `format` | string | No | Output format: "markdown", "text", "html" (default: "markdown") |

### Response Format

```json
{
  "results": [
    {
      "url": "https://example.com",
      "content": "# Example Page\n\nThis is the content...",
      "success": true,
      "metadata": {
        "title": "Example Page",
        "description": "An example webpage",
        "author": "John Doe",
        "publish_date": "2024-01-15"
      }
    }
  ]
}
```

## Use Cases

### 1. Content Aggregation

Collect articles and blog posts for analysis:

```python
def scrape_news_articles(urls):
    response = requests.post(
        "https://api.cxmpute.cloud/v1/scrape",
        headers=headers,
        json={"urls": urls, "format": "markdown"}
    )
    
    articles = []
    for result in response.json()["results"]:
        if result["success"]:
            articles.append({
                "url": result["url"],
                "title": result["metadata"].get("title", "Unknown"),
                "content": result["content"],
                "publish_date": result["metadata"].get("publish_date")
            })
    
    return articles

# Usage
news_urls = [
    "https://techcrunch.com/article1",
    "https://arstechnica.com/article2"
]
articles = scrape_news_articles(news_urls)
```

### 2. Research Data Collection

Gather information for research projects:

```python
def research_scraper(search_urls, keywords):
    scraped_data = []
    
    response = requests.post(
        "https://api.cxmpute.cloud/v1/scrape",
        headers=headers,
        json={"urls": search_urls, "format": "text"}
    )
    
    for result in response.json()["results"]:
        if result["success"]:
            content = result["content"].lower()
            keyword_matches = sum(content.count(kw.lower()) for kw in keywords)
            
            if keyword_matches > 0:
                scraped_data.append({
                    "url": result["url"],
                    "relevance_score": keyword_matches,
                    "content": result["content"],
                    "metadata": result["metadata"]
                })
    
    return sorted(scraped_data, key=lambda x: x["relevance_score"], reverse=True)
```

### 3. E-commerce Product Monitoring

Track product information and pricing:

```python
def monitor_product_pages(product_urls):
    response = requests.post(
        "https://api.cxmpute.cloud/v1/scrape",
        headers=headers,
        json={"urls": product_urls, "format": "html"}
    )
    
    products = []
    for result in response.json()["results"]:
        if result["success"]:
            # Extract price and availability (simplified example)
            content = result["content"]
            # Use regex or HTML parsing to extract specific data
            products.append({
                "url": result["url"],
                "title": result["metadata"].get("title"),
                "raw_content": content,
                "scraped_at": datetime.now().isoformat()
            })
    
    return products
```

### 4. Documentation Aggregation

Collect API documentation and guides:

```python
def scrape_documentation(doc_urls):
    response = requests.post(
        "https://api.cxmpute.cloud/v1/scrape",
        headers=headers,
        json={"urls": doc_urls, "format": "markdown"}
    )
    
    docs = []
    for result in response.json()["results"]:
        if result["success"]:
            docs.append({
                "url": result["url"],
                "title": result["metadata"].get("title"),
                "content": result["content"],
                "sections": extract_sections(result["content"])
            })
    
    return docs

def extract_sections(markdown_content):
    """Extract sections from markdown content"""
    sections = []
    current_section = None
    
    for line in markdown_content.split('\n'):
        if line.startswith('#'):
            if current_section:
                sections.append(current_section)
            current_section = {
                "title": line.strip('#').strip(),
                "content": ""
            }
        elif current_section:
            current_section["content"] += line + "\n"
    
    if current_section:
        sections.append(current_section)
    
    return sections
```

## Advanced Features

### Batch Processing with Error Handling

```python
import time
from concurrent.futures import ThreadPoolExecutor

def scrape_urls_batch(urls, batch_size=10, max_retries=3):
    """Scrape URLs in batches with retry logic"""
    
    def scrape_batch(url_batch):
        for attempt in range(max_retries):
            try:
                response = requests.post(
                    "https://api.cxmpute.cloud/v1/scrape",
                    headers=headers,
                    json={"urls": url_batch, "format": "markdown"},
                    timeout=60
                )
                
                if response.status_code == 200:
                    return response.json()["results"]
                elif response.status_code == 503:
                    time.sleep(2 ** attempt)
                    continue
                else:
                    response.raise_for_status()
                    
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    # Return failed results for this batch
                    return [{"url": url, "success": False, "error": str(e)} for url in url_batch]
                time.sleep(1)
    
    # Split URLs into batches
    batches = [urls[i:i + batch_size] for i in range(0, len(urls), batch_size)]
    all_results = []
    
    for batch in batches:
        results = scrape_batch(batch)
        all_results.extend(results)
        print(f"Processed batch of {len(batch)} URLs")
    
    return all_results
```

### Content Filtering and Extraction

```python
def extract_article_content(scraped_results):
    """Extract main article content from scraped pages"""
    
    articles = []
    for result in scraped_results:
        if not result["success"]:
            continue
            
        content = result["content"]
        metadata = result["metadata"]
        
        # Basic content filtering
        if len(content) < 100:  # Skip very short content
            continue
            
        # Extract meaningful content
        article = {
            "url": result["url"],
            "title": metadata.get("title", ""),
            "author": metadata.get("author", ""),
            "publish_date": metadata.get("publish_date", ""),
            "content": content,
            "word_count": len(content.split()),
            "reading_time": len(content.split()) // 200  # Approximate reading time
        }
        
        articles.append(article)
    
    return articles
```

### Integration with AI Services

Combine scraping with AI analysis:

```python
def scrape_and_analyze(urls, analysis_type="summary"):
    """Scrape content and analyze it with AI"""
    
    # Scrape content
    scrape_response = requests.post(
        "https://api.cxmpute.cloud/v1/scrape",
        headers=headers,
        json={"urls": urls, "format": "text"}
    )
    
    results = []
    for result in scrape_response.json()["results"]:
        if not result["success"]:
            continue
            
        content = result["content"]
        
        # Analyze with AI
        if analysis_type == "summary":
            prompt = f"Summarize this article in 2-3 sentences:\n\n{content[:2000]}"
        elif analysis_type == "sentiment":
            prompt = f"Analyze the sentiment of this text:\n\n{content[:2000]}"
        elif analysis_type == "keywords":
            prompt = f"Extract the main keywords and topics from this text:\n\n{content[:2000]}"
        
        ai_response = requests.post(
            "https://api.cxmpute.cloud/v1/chat/completions",
            headers=headers,
            json={
                "model": "llama3.1:8b",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3
            }
        )
        
        if ai_response.status_code == 200:
            analysis = ai_response.json()["choices"][0]["message"]["content"]
        else:
            analysis = "Analysis failed"
        
        results.append({
            "url": result["url"],
            "title": result["metadata"].get("title", ""),
            "content": content,
            "analysis": analysis,
            "analysis_type": analysis_type
        })
    
    return results

# Usage
urls = ["https://techcrunch.com/some-article"]
analyzed_content = scrape_and_analyze(urls, "summary")
```

## Best Practices

### 1. Rate Limiting and Politeness

```python
import time
import random

def polite_scraper(urls, delay_range=(1, 3)):
    """Scrape URLs with respectful delays"""
    
    results = []
    for i, url in enumerate(urls):
        # Add delay between requests
        if i > 0:
            delay = random.uniform(*delay_range)
            time.sleep(delay)
        
        response = requests.post(
            "https://api.cxmpute.cloud/v1/scrape",
            headers=headers,
            json={"urls": [url], "format": "markdown"}
        )
        
        if response.status_code == 200:
            results.extend(response.json()["results"])
        
        print(f"Scraped {i+1}/{len(urls)} URLs")
    
    return results
```

### 2. Content Validation

```python
def validate_scraped_content(results, min_length=100):
    """Validate and filter scraped content"""
    
    valid_results = []
    for result in results:
        if not result["success"]:
            print(f"Skipping failed URL: {result['url']}")
            continue
        
        content = result["content"]
        
        # Check content length
        if len(content) < min_length:
            print(f"Skipping short content from {result['url']}")
            continue
        
        # Check for common error pages
        error_indicators = [
            "404 not found",
            "access denied",
            "page not found",
            "forbidden"
        ]
        
        if any(indicator in content.lower() for indicator in error_indicators):
            print(f"Detected error page: {result['url']}")
            continue
        
        valid_results.append(result)
    
    return valid_results
```

### 3. Caching and Storage

```python
import json
import hashlib
from datetime import datetime, timedelta

class ScrapingCache:
    def __init__(self, cache_file="scraping_cache.json", cache_duration_hours=24):
        self.cache_file = cache_file
        self.cache_duration = timedelta(hours=cache_duration_hours)
        self.cache = self._load_cache()
    
    def _load_cache(self):
        try:
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
    
    def _save_cache(self):
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)
    
    def _get_cache_key(self, url, format_type):
        return hashlib.md5(f"{url}:{format_type}".encode()).hexdigest()
    
    def get_cached_result(self, url, format_type="markdown"):
        cache_key = self._get_cache_key(url, format_type)
        
        if cache_key in self.cache:
            cached_item = self.cache[cache_key]
            cached_time = datetime.fromisoformat(cached_item["timestamp"])
            
            if datetime.now() - cached_time < self.cache_duration:
                return cached_item["result"]
        
        return None
    
    def cache_result(self, url, format_type, result):
        cache_key = self._get_cache_key(url, format_type)
        
        self.cache[cache_key] = {
            "timestamp": datetime.now().isoformat(),
            "result": result
        }
        
        self._save_cache()
    
    def scrape_with_cache(self, urls, format_type="markdown"):
        cached_results = []
        urls_to_scrape = []
        
        # Check cache first
        for url in urls:
            cached = self.get_cached_result(url, format_type)
            if cached:
                cached_results.append(cached)
            else:
                urls_to_scrape.append(url)
        
        # Scrape uncached URLs
        if urls_to_scrape:
            response = requests.post(
                "https://api.cxmpute.cloud/v1/scrape",
                headers=headers,
                json={"urls": urls_to_scrape, "format": format_type}
            )
            
            if response.status_code == 200:
                new_results = response.json()["results"]
                
                # Cache new results
                for result in new_results:
                    self.cache_result(result["url"], format_type, result)
                
                cached_results.extend(new_results)
        
        return cached_results

# Usage
cache = ScrapingCache(cache_duration_hours=6)
results = cache.scrape_with_cache(["https://example.com", "https://test.com"])
```

## Pricing

During our **testnet phase**, web scraping services are completely **free**! Once we transition to mainnet:

- **Standard Scraping**: ~$0.02-0.10 per request
- **Batch Discounts**: Available for high-volume usage
- **Premium Features**: Enhanced extraction and custom parsing

## Error Handling

Common error codes and solutions:

- `400`: Invalid URL or malformed request
- `403`: Access denied or blocked by target site
- `404`: Page not found
- `408`: Request timeout
- `503`: No scraping providers available

## Support

- **Discord**: [Community support](https://discord.com/invite/CJGA7B2zKT)
- **Documentation**: [Complete API reference](/docs/user)
- **Examples**: [GitHub repository](https://github.com/unxversal/cxmpute-core)

---

**Ready to extract web content?** Start building data collection pipelines with our reliable scraping service! 