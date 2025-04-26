interface SystemMetadataRecord {
    endpoint: string;        // API endpoint
    model?: string;          // Optional model name
    vramRequired: number;    // in MB
    storageRequired: number; // in MB
    provisionTargetNumber: number;
  }
  
  export const SystemProvisionReference: SystemMetadataRecord[] = [
    // EMBEDDINGS
    {
      endpoint: "/embeddings",
      model: "nomic-embed-text",
      vramRequired: 274,
      storageRequired: 274,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "mxbai-embed-large",
      vramRequired: 670,
      storageRequired: 670,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "bge-m3",
      vramRequired: 1200,
      storageRequired: 1200,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "snowflake-arctic-embed:22m",
      vramRequired: 46,
      storageRequired: 46,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "snowflake-arctic-embed:33m",
      vramRequired: 67,
      storageRequired: 67,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "snowflake-arctic-embed:110m",
      vramRequired: 219,
      storageRequired: 219,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "snowflake-arctic-embed:137m",
      vramRequired: 274,
      storageRequired: 274,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "snowflake-arctic-embed:335m",
      vramRequired: 669,
      storageRequired: 669,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "all-minilm:33m",
      vramRequired: 67,
      storageRequired: 67,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "all-minilm:22m",
      vramRequired: 46,
      storageRequired: 46,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/embeddings",
      model: "snowflake-arctic-embed2",
      vramRequired: 1200,
      storageRequired: 1200,
      provisionTargetNumber: 10000,
    },
  
    // VISION (all share /chat/completions)
    {
      endpoint: "/chat/completions",
      model: "gemma3:1b",
      vramRequired: 815,
      storageRequired: 815,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "gemma3:4b",
      vramRequired: 3300,
      storageRequired: 3300,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "gemma3:12b",
      vramRequired: 8100,
      storageRequired: 8100,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "gemma3:24b",
      vramRequired: 17000,
      storageRequired: 17000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "llama3.2-vision:11b",
      vramRequired: 7900,
      storageRequired: 7900,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "minicpm-v",
      vramRequired: 5500,
      storageRequired: 5500,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "llava-llama3",
      vramRequired: 5500,
      storageRequired: 5500,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "moondream",
      vramRequired: 1700,
      storageRequired: 1700,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "granite3.2-vision",
      vramRequired: 2400,
      storageRequired: 2400,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "mistral-small3.1",
      vramRequired: 15000,
      storageRequired: 15000,
      provisionTargetNumber: 10000,
    },
  
    // TEXT (/chat/completions)
    {
      endpoint: "/chat/completions",
      model: "cogito:14b",
      vramRequired: 9000,
      storageRequired: 9000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "cogito:32b",
      vramRequired: 20000,
      storageRequired: 20000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "cogito:3b",
      vramRequired: 2200,
      storageRequired: 2200,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "cogito:70b",
      vramRequired: 43000,
      storageRequired: 43000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "cogito:8b",
      vramRequired: 4900,
      storageRequired: 4900,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-r1:1.5b",
      vramRequired: 1100,
      storageRequired: 1100,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-r1:14b",
      vramRequired: 9000,
      storageRequired: 9000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-r1:32b",
      vramRequired: 20000,
      storageRequired: 20000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-r1:70b",
      vramRequired: 43000,
      storageRequired: 43000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-r1:7b",
      vramRequired: 4700,
      storageRequired: 4700,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-r1:8b",
      vramRequired: 4900,
      storageRequired: 4900,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "llama3.1:8b",
      vramRequired: 4900,
      storageRequired: 4900,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "llama3.2:1b",
      vramRequired: 1300,
      storageRequired: 1300,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "llama3.2:3b",
      vramRequired: 2000,
      storageRequired: 2000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "llama3.3",
      vramRequired: 43000,
      storageRequired: 43000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "mistral",
      vramRequired: 4100,
      storageRequired: 4100,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "mistral-nemo",
      vramRequired: 7100,
      storageRequired: 7100,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "phi4",
      vramRequired: 9100,
      storageRequired: 9100,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "phi4-mini",
      vramRequired: 2600,
      storageRequired: 2600,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2.5:14b",
      vramRequired: 9000,
      storageRequired: 9000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2.5:32b",
      vramRequired: 20000,
      storageRequired: 20000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2.5:72b",
      vramRequired: 47000,
      storageRequired: 47000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2.5:7b",
      vramRequired: 4700,
      storageRequired: 4700,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwq",
      vramRequired: 20000,
      storageRequired: 20000,
      provisionTargetNumber: 10000,
    },
  
    // MATH (/chat/completions)
    {
      endpoint: "/chat/completions",
      model: "mathstral",
      vramRequired: 4100,
      storageRequired: 4100,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2-math:7b",
      vramRequired: 4400,
      storageRequired: 4400,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2-math:72b",
      vramRequired: 41000,
      storageRequired: 41000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepscaler",
      vramRequired: 3600,
      storageRequired: 3600,
      provisionTargetNumber: 10000,
    },
  
    // CODE (/chat/completions)
    {
      endpoint: "/chat/completions",
      model: "qwen2.5-coder:3b",
      vramRequired: 1900,
      storageRequired: 1900,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2.5-coder:7b",
      vramRequired: 4700,
      storageRequired: 4700,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2.5-coder:14b",
      vramRequired: 9000,
      storageRequired: 9000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "qwen2.5-coder:32b",
      vramRequired: 20000,
      storageRequired: 20000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepcoder:14b",
      vramRequired: 9000,
      storageRequired: 9000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "codegemma:2b",
      vramRequired: 1600,
      storageRequired: 1600,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "codegemma:7b",
      vramRequired: 5000,
      storageRequired: 5000,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-coder:1.3b",
      vramRequired: 776,
      storageRequired: 776,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-coder:6.7b",
      vramRequired: 3800,
      storageRequired: 3800,
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/chat/completions",
      model: "deepseek-coder-v2:16b",
      vramRequired: 8900,
      storageRequired: 8900,
      provisionTargetNumber: 10000,
    },
  
    // IMAGE
    {
      endpoint: "/image",
      model: "stable diffusion 2.1",
      vramRequired: 8192,    // 8 GB
      storageRequired: 2048, // 2 GB
      provisionTargetNumber: 10000,
    },
  
    // AUDIO
    {
      endpoint: "/tts",
      model: "kokoro-82m",
      vramRequired: 90,
      storageRequired: 90,
      provisionTargetNumber: 10000,
    },
  
    // VIDEO
    {
      endpoint: "/video",
      model: "Wan-AI/Wan2.1-T2V-1.3B",
      vramRequired: 8192,     // 8 GB
      storageRequired: 20000, // 20 GB
      provisionTargetNumber: 10000,
    },
    {
      endpoint: "/m",
      vramRequired: 2500,     // 2.5 GB
      storageRequired: 2500, // 20 GB
      provisionTargetNumber: 10000,
    }
  ];

// Helper function to parse modalities
const parseModalities = (modalitiesString: string): string[] => {
  if (!modalitiesString) {
    return [];
  }
  return modalitiesString.split(',').map(m => m.trim()).filter(m => m);
};

// Helper function to attempt parsing vector size from outputLength for embeddings
const parseVectorSize = (category: string, outputLengthStr: string | undefined): number | undefined => {
    if (category?.toLowerCase() !== 'embeddings' || !outputLengthStr) {
        return undefined;
    }
    // Try to find the first number, assuming it's the primary dimension
    const match = outputLengthStr.match(/\d+/);
    if (match) {
        const size = parseInt(match[0], 10);
        return isNaN(size) ? undefined : size;
    }
    return undefined;
};


// The data array conforming to the Models[] type
// Helper function to generate a URL-friendly slug from a name
const generateSlug = (name: string): string => {
  return name
      .toLowerCase() // Convert to lowercase
      .replace(/[:\/.]/g, '-') // Replace colons, slashes, periods with hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^\w-]+/g, '') // Remove all non-word chars except hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with a single hyphen
      .replace(/^-+/, '') // Trim hyphens from start of text
      .replace(/-+$/, ''); // Trim hyphens from end of text
};


// Define the updated interface
export interface Models {
  Name: string;
  InputModalities: string[];
  OutputModalities: string[];
  Category: string;
  description: string; // Markdown formatted description
  Creator: string;
  creatorUrl: string;
  blogUrl?: string; // Optional as some entries might not have it
  contextSize?: string; // Optional
  outputLength?: string; // Optional, used for token count or vector dimension string
  vectorSize?: number; // Optional, specifically for embedding vector dimensions
  slug: string; // Optional, slug for the model
  docs: string; // Markdown formatted documentation including explanation and sample request
}

// Generate docs for Embeddings models
const generateEmbeddingsDocs = (modelName: string): string => {
    const endpointRoute = "/api/v1/embeddings";
    // Extract relevant parts if needed, or just reference it.
    // For simplicity, we'll create a summary and provide a sample.
    return `
### Documentation for ${modelName}

Generates text embeddings using the \`${endpointRoute}\` endpoint. This model converts input text into numerical vectors suitable for tasks like semantic search, clustering, and classification.

Refer to the full documentation for the \`${endpointRoute}\` endpoint for details on headers, parameters (\`truncate\`, \`keep_alive\`, etc.), error handling, and response format.

#### Sample Request (cURL)

\`\`\`bash
# Replace <your-orchestrator-host> and <API_KEY> with your actual values
curl https://<your-orchestrator-host>/api/v1/embeddings \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "X-User-Id: your_user_id_123" \\
  -H "Content-Type: application/json" \\
  -d '{
        "model": "${modelName}",
        "input": ["Your text sentence here.", "Another sentence to embed."],
        "truncate": true,
        "keep_alive": "5m"
      }'
\`\`\`
`;
};

// Generate docs for Chat/Vision/Text/Math/Code models
const generateChatCompletionsDocs = (modelName: string, isVision: boolean = false): string => {
    const endpointRoute = "/api/v1/chat/completions";
    const visionNote = isVision ? "This model also supports image inputs alongside text." : "";
    return `
### Documentation for ${modelName}

Used for chat completions via the OpenAI-compatible \`${endpointRoute}\` endpoint. ${visionNote} It can be used for various tasks like text generation, question answering, summarization, coding, and mathematical reasoning, depending on the model's specialization.

This endpoint mirrors the OpenAI API structure, allowing you to use existing OpenAI SDKs by changing the \`baseURL\`. Refer to the full documentation for the \`${endpointRoute}\` endpoint for details on headers, parameters (\`stream\`, \`temperature\`, \`max_tokens\`, \`tools\`/\`functions\`, \`response_format\`, etc.), error handling, and response format (including streaming).

#### Sample Request (cURL - Non-streaming)

\`\`\`bash
# Replace <your-orchestrator-host> and <API_KEY> with your actual values
curl https://<your-orchestrator-host>/api/v1/chat/completions \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "X-User-Id: your_user_id_123" \\
  -H "Content-Type: application/json" \\
  -d '{
        "model": "${modelName}",
        "messages": [
          { "role": "system", "content": "You are a helpful assistant." },
          { "role": "user", "content": "Explain the concept of ${isVision ? 'multimodal AI' : 'transformer models'} in simple terms." }
        ],
        "temperature": 0.7,
        "max_tokens": 150
      }'
\`\`\`

#### Sample Request (Python SDK)

\`\`\`python
from openai import OpenAI

client = OpenAI(
    api_key="<API_KEY>", # Replace with your key
    base_url="https://<your-orchestrator-host>/api/v1", # Replace with your host
    default_headers={
        "X-User-Id": "your_user_id_123"
    }
)

try:
    response = client.chat.completions.create(
        model="${modelName}",
        messages=[
            {"role": "system", "content": "You are a helpful coding assistant."},
            {"role": "user", "content": "Write a python function to calculate factorial."}
            # For vision models, add image content if supported by your SDK/setup
            # {"role": "user", "content": [
            #     {"type": "text", "text": "Describe this image"},
            #     {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
            # ]}
        ],
        temperature=0.5,
        stream=False # Set to True for streaming response
    )
    print(response.choices[0].message.content)
except Exception as e:
    print(f"An error occurred: {e}")

\`\`\`
`;
};

// Generate docs for Image models
const generateImageDocs = (modelName: string): string => {
    const endpointRoute = "/api/v1/image";
    // Note: The image endpoint docs don't show 'model' in the request body.
    // The selection might happen based on the endpoint/provisioning, not the request body.
    return `
### Documentation for ${modelName}

Generates images from text prompts using the \`${endpointRoute}\` endpoint. This specific model (${modelName}) is used internally by the service when this endpoint is called, based on system configuration.

The endpoint accepts a text prompt and various parameters to control the image generation process. Refer to the full documentation for the \`${endpointRoute}\` endpoint for details on headers, parameters (\`negativePrompt\`, \`numInferenceSteps\`, \`width\`, \`height\`, etc.), error handling, and the PNG image stream response format.

#### Sample Request (cURL)

\`\`\`bash
# Replace <your-orchestrator-host> and <API_KEY> with your actual values
# The specific model (${modelName}) is typically selected by the backend for this endpoint.
curl https://<your-orchestrator-host>/api/v1/image \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "X-User-Id: your_user_id_123" \\
  -H "Content-Type: application/json" \\
  --output generated_image.png \\
  -d '{
        "prompt": "A photo of an astronaut riding a horse on the moon",
        "negativePrompt": "cartoon, drawing, sketch, low quality, blurry",
        "numInferenceSteps": 30,
        "width": 768,
        "height": 768
      }'
\`\`\`
`;
};

// Generate docs for Audio (TTS) models
const generateTtsDocs = (modelName: string): string => {
    const endpointRoute = "/api/v1/tts";
    // Note: The TTS endpoint docs don't show 'model' in the request body.
    return `
### Documentation for ${modelName}

Performs Text-to-Speech (TTS) synthesis using the \`${endpointRoute}\` endpoint. This specific model (${modelName}) is used internally by the service when this endpoint is called, based on system configuration.

The endpoint accepts text and an optional voice ID to generate audio. Refer to the full documentation for the \`${endpointRoute}\` endpoint for details on headers, parameters (\`voice\`), error handling, and the WAV audio stream response format.

#### Sample Request (cURL)

\`\`\`bash
# Replace <your-orchestrator-host> and <API_KEY> with your actual values
# The specific model (${modelName}) is typically selected by the backend for this endpoint.
curl https://<your-orchestrator-host>/api/v1/tts \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "X-User-Id: your_user_id_123" \\
  -H "Content-Type: application/json" \\
  --output speech_output.wav \\
  -d '{
        "text": "Hello from the decentralized network! This audio was generated using Kokoro.",
        "voice": "af_nicole" # Optional: See endpoint docs for available voices
      }'
\`\`\`
`;
};

// Generate docs for Video models
const generateVideoDocs = (modelName: string): string => {
    const endpointRoute = "/api/v1/video";
     // Note: The video endpoint docs don't show 'model' in the request body.
    return `
### Documentation for ${modelName}

Generates video from text prompts using the \`${endpointRoute}\` endpoint. This specific model (${modelName}) is used internally by the service when this endpoint is called, based on system configuration.

The endpoint accepts a text prompt and parameters like resolution and generation settings. Refer to the full documentation for the \`${endpointRoute}\` endpoint for details on headers, parameters (\`size\`, \`sample_guide_scale\`, etc.), error handling, and the MP4 video stream response format.

#### Sample Request (cURL)

\`\`\`bash
# Replace <your-orchestrator-host> and <API_KEY> with your actual values
# The specific model (${modelName}) is typically selected by the backend for this endpoint.
curl https://<your-orchestrator-host>/api/v1/video \\
  -H "Authorization: Bearer <API_KEY>" \\
  -H "X-User-Id: your_user_id_123" \\
  -H "Content-Type: application/json" \\
  --output generated_video.mp4 \\
  -d '{
        "prompt": "A cinematic shot of a spaceship flying through a nebula",
        "size": "832*480",
        "sample_guide_scale": 7,
        "offload_model": true
      }'
\`\`\`
`;
};


// The data array conforming to the Models[] type with docs added
export const models: Models[] = [
{
  Name: "nomic-embed-text",
  Category: "embeddings",
  description: "`nomic-embed-text` is a large context length text encoder that surpasses OpenAI `text-embedding-ada-002` and `text-embedding-3-small` performance on short and long context tasks.",
  Creator: "Nomic AI",
  creatorUrl: "https://www.nomic.ai/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "8192",
  outputLength: "vector dimensions: 768, 512, 256, 128, 64",
  blogUrl: "https://www.nomic.ai/blog/posts/nomic-embed-text-v1",
  vectorSize: parseVectorSize("embeddings", "vector dimensions: 768, 512, 256, 128, 64"), // Parses 768
  slug: generateSlug("nomic-embed-text"), // "nomic-embed-text"
  docs: generateEmbeddingsDocs("nomic-embed-text")
},
{
  Name: "mxbai-embed-large",
  Category: "embeddings",
  description: "As of March 2024, this model archives SOTA performance for Bert-large sized models on the MTEB. It outperforms commercial models like OpenAIs `text-embedding-3-large` model and matches the performance of model 20x its size. `mxbai-embed-large` was trained with no overlap of the MTEB data, which indicates that the model generalizes well across several domains, tasks and text length.",
  Creator: "Mixedbread AI",
  creatorUrl: "https://www.mixedbread.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "512",
  outputLength: "up to 1024",
  blogUrl: "https://www.mixedbread.com/blog/mxbai-embed-large-v1",
  vectorSize: parseVectorSize("embeddings", "up to 1024"), // Parses 1024
  slug: generateSlug("mxbai-embed-large"), // "mxbai-embed-large"
  docs: generateEmbeddingsDocs("mxbai-embed-large")
},
{
  Name: "bge-m3",
  Category: "embeddings",
  description: `\`BGE-M3\` is based on the XLM-RoBERTa architecture and is distinguished for its versatility in Multi-Functionality, Multi-Linguality, and Multi-Granularity:

*   **Multi-Functionality**: It can simultaneously perform the three common retrieval functionalities of embedding model: dense retrieval, multi-vector retrieval, and sparse retrieval.
*   **Multi-Linguality**: It can support more than 100 working languages.
*   **Multi-Granularity**: It is able to process inputs of different granularities, spanning from short sentences to long documents of up to 8192 tokens.`,
  Creator: "BAAI",
  creatorUrl: "https://www.baai.ac.cn/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "8192",
  outputLength: "1024",
  blogUrl: "https://arxiv.org/pdf/2402.03216",
  vectorSize: parseVectorSize("embeddings", "1024"), // Parses 1024
  slug: generateSlug("bge-m3"), // "bge-m3"
  docs: generateEmbeddingsDocs("bge-m3")
},
{
  Name: "snowflake-arctic-embed:22m",
  Category: "embeddings",
  description: `\`snowflake-arctic-embed\` is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.

The models are trained by leveraging existing open-source text representation models, such as \`bert-base-uncased\`, and are trained in a multi-stage pipeline to optimize their retrieval performance.

This model is available in 5 parameter sizes:

*   \`snowflake-arctic-embed:335m\` (default)
*   \`snowflake-arctic-embed:137m\`
*   \`snowflake-arctic-embed:110m\`
*   \`snowflake-arctic-embed:33m\`
*   \`snowflake-arctic-embed:22m\``,
  Creator: "Snowflake",
  creatorUrl: "https://www.snowflake.com/en/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "512",
  outputLength: "384",
  blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
  vectorSize: parseVectorSize("embeddings", "384"), // Parses 384
  slug: generateSlug("snowflake-arctic-embed:22m"), // "snowflake-arctic-embed-22m"
  docs: generateEmbeddingsDocs("snowflake-arctic-embed:22m")
},
{
  Name: "snowflake-arctic-embed:33m",
  Category: "embeddings",
  description: `\`snowflake-arctic-embed\` is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.

The models are trained by leveraging existing open-source text representation models, such as \`bert-base-uncased\`, and are trained in a multi-stage pipeline to optimize their retrieval performance.

This model is available in 5 parameter sizes:

*   \`snowflake-arctic-embed:335m\` (default)
*   \`snowflake-arctic-embed:137m\`
*   \`snowflake-arctic-embed:110m\`
*   \`snowflake-arctic-embed:33m\`
*   \`snowflake-arctic-embed:22m\``,
  Creator: "Snowflake",
  creatorUrl: "https://www.snowflake.com/en/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "512",
  outputLength: "384",
  blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
  vectorSize: parseVectorSize("embeddings", "384"), // Parses 384
  slug: generateSlug("snowflake-arctic-embed:33m"), // "snowflake-arctic-embed-33m"
  docs: generateEmbeddingsDocs("snowflake-arctic-embed:33m")
},
{
  Name: "snowflake-arctic-embed:110m",
  Category: "embeddings",
  description: `\`snowflake-arctic-embed\` is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.

The models are trained by leveraging existing open-source text representation models, such as \`bert-base-uncased\`, and are trained in a multi-stage pipeline to optimize their retrieval performance.

This model is available in 5 parameter sizes:

*   \`snowflake-arctic-embed:335m\` (default)
*   \`snowflake-arctic-embed:137m\`
*   \`snowflake-arctic-embed:110m\`
*   \`snowflake-arctic-embed:33m\`
*   \`snowflake-arctic-embed:22m\``,
  Creator: "Snowflake",
  creatorUrl: "https://www.snowflake.com/en/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "512",
  outputLength: "768",
  blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
  vectorSize: parseVectorSize("embeddings", "768"), // Parses 768
  slug: generateSlug("snowflake-arctic-embed:110m"), // "snowflake-arctic-embed-110m"
  docs: generateEmbeddingsDocs("snowflake-arctic-embed:110m")
},
{
  Name: "snowflake-arctic-embed:137m",
  Category: "embeddings",
  description: `\`snowflake-arctic-embed\` is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.

The models are trained by leveraging existing open-source text representation models, such as \`bert-base-uncased\`, and are trained in a multi-stage pipeline to optimize their retrieval performance.

This model is available in 5 parameter sizes:

*   \`snowflake-arctic-embed:335m\` (default)
*   \`snowflake-arctic-embed:137m\`
*   \`snowflake-arctic-embed:110m\`
*   \`snowflake-arctic-embed:33m\`
*   \`snowflake-arctic-embed:22m\``,
  Creator: "Snowflake",
  creatorUrl: "https://www.snowflake.com/en/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "8192",
  outputLength: "768",
  blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
  vectorSize: parseVectorSize("embeddings", "768"), // Parses 768
  slug: generateSlug("snowflake-arctic-embed:137m"), // "snowflake-arctic-embed-137m"
  docs: generateEmbeddingsDocs("snowflake-arctic-embed:137m")
},
{
  Name: "snowflake-arctic-embed:335m",
  Category: "embeddings",
  description: `\`snowflake-arctic-embed\` is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.

The models are trained by leveraging existing open-source text representation models, such as \`bert-base-uncased\`, and are trained in a multi-stage pipeline to optimize their retrieval performance.

This model is available in 5 parameter sizes:

*   \`snowflake-arctic-embed:335m\` (default)
*   \`snowflake-arctic-embed:137m\`
*   \`snowflake-arctic-embed:110m\`
*   \`snowflake-arctic-embed:33m\`
*   \`snowflake-arctic-embed:22m\``,
  Creator: "Snowflake",
  creatorUrl: "https://www.snowflake.com/en/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "512",
  outputLength: "1024",
  blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
  vectorSize: parseVectorSize("embeddings", "1024"), // Parses 1024
  slug: generateSlug("snowflake-arctic-embed:335m"), // "snowflake-arctic-embed-335m"
  docs: generateEmbeddingsDocs("snowflake-arctic-embed:335m")
},
{
  Name: "all-minilm:33m",
  Category: "embeddings",
  description: "The model is intended to be used as a sentence and short paragraph encoder. Given an input text, it outputs a vector which captures the semantic information. The sentence vector may be used for information retrieval, clustering or sentence similarity tasks.",
  Creator: "Sentence Transformers",
  creatorUrl: "https://huggingface.co/sentence-transformers",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "256",
  outputLength: "384",
  blogUrl: undefined, // No blog post listed
  vectorSize: parseVectorSize("embeddings", "384"), // Parses 384
  slug: generateSlug("all-minilm:33m"), // "all-minilm-33m"
  docs: generateEmbeddingsDocs("all-minilm:33m")
},
{
  Name: "all-minilm:22m",
  Category: "embeddings",
  description: "The model is intended to be used as a sentence and short paragraph encoder. Given an input text, it outputs a vector which captures the semantic information. The sentence vector may be used for information retrieval, clustering or sentence similarity tasks.",
  Creator: "Sentence Transformers",
  creatorUrl: "https://huggingface.co/sentence-transformers",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "256",
  outputLength: "384",
  blogUrl: undefined, // No blog post listed
  vectorSize: parseVectorSize("embeddings", "384"), // Parses 384
  slug: generateSlug("all-minilm:22m"), // "all-minilm-22m"
  docs: generateEmbeddingsDocs("all-minilm:22m")
},
{
  Name: "snowflake-arctic-embed2",
  Category: "embeddings",
  description: "Snowflake's frontier embedding model. Arctic Embed 2.0 adds multilingual support without sacrificing English performance or scalability.",
  Creator: "Snowflake",
  creatorUrl: "https://www.snowflake.com/en/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("vector"),
  contextSize: "512",
  outputLength: "1024",
  blogUrl: "https://arxiv.org/pdf/2412.04506",
  vectorSize: parseVectorSize("embeddings", "1024"), // Parses 1024
  slug: generateSlug("snowflake-arctic-embed2"), // "snowflake-arctic-embed2"
  docs: generateEmbeddingsDocs("snowflake-arctic-embed2")
},
{
  Name: "gemma3:1b",
  Category: "vision",
  description: "Gemma is a lightweight, family of models from Google built on Gemini technology. The Gemma 3 models are multimodal—processing text and images—and feature a 128K context window with support for over 140 languages. Available in 1B, 4B, 12B, and 27B parameter sizes, they excel in tasks like question answering, summarization, and reasoning, while their compact design allows deployment on resource-limited devices.",
  Creator: "Google",
  creatorUrl: "https://huggingface.co/google",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "32k",
  outputLength: "8192",
  blogUrl: "https://blog.google/technology/developers/gemma-3/",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("gemma3:1b"), // "gemma3-1b"
  docs: generateChatCompletionsDocs("gemma3:1b", true)
},
{
  Name: "gemma3:4b",
  Category: "vision",
  description: "Gemma is a lightweight, family of models from Google built on Gemini technology. The Gemma 3 models are multimodal—processing text and images—and feature a 128K context window with support for over 140 languages. Available in 1B, 4B, 12B, and 27B parameter sizes, they excel in tasks like question answering, summarization, and reasoning, while their compact design allows deployment on resource-limited devices.",
  Creator: "Google",
  creatorUrl: "https://huggingface.co/google",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8192",
  blogUrl: "https://blog.google/technology/developers/gemma-3/",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("gemma3:4b"), // "gemma3-4b"
  docs: generateChatCompletionsDocs("gemma3:4b", true)
},
{
  Name: "gemma3:12b",
  Category: "vision",
  description: "Gemma is a lightweight, family of models from Google built on Gemini technology. The Gemma 3 models are multimodal—processing text and images—and feature a 128K context window with support for over 140 languages. Available in 1B, 4B, 12B, and 27B parameter sizes, they excel in tasks like question answering, summarization, and reasoning, while their compact design allows deployment on resource-limited devices.",
  Creator: "Google",
  creatorUrl: "https://huggingface.co/google",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8192",
  blogUrl: "https://blog.google/technology/developers/gemma-3/",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("gemma3:12b"), // "gemma3-12b"
  docs: generateChatCompletionsDocs("gemma3:12b", true)
},
{
  Name: "gemma3:24b",
  Category: "vision",
  description: "Gemma is a lightweight, family of models from Google built on Gemini technology. The Gemma 3 models are multimodal—processing text and images—and feature a 128K context window with support for over 140 languages. Available in 1B, 4B, 12B, and 27B parameter sizes, they excel in tasks like question answering, summarization, and reasoning, while their compact design allows deployment on resource-limited devices.",
  Creator: "Google",
  creatorUrl: "https://huggingface.co/google",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8192",
  blogUrl: "https://blog.google/technology/developers/gemma-3/",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("gemma3:24b"), // "gemma3-24b"
  docs: generateChatCompletionsDocs("gemma3:24b", true)
},
{
  Name: "llama3.2-vision:11b",
  Category: "vision",
  description: `The Llama 3.2-Vision collection of multimodal large language models (LLMs) is a collection of instruction-tuned image reasoning generative models in 11B and 90B sizes (text + images in / text out). The Llama 3.2-Vision instruction-tuned models are optimized for visual recognition, image reasoning, captioning, and answering general questions about an image. The models outperform many of the available open source and closed multimodal models on common industry benchmarks.

**Supported Languages**: For text only tasks, English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai are officially supported. Llama 3.2 has been trained on a broader collection of languages than these 8 supported languages. Note for image+text applications, English is the only language supported.`,
  Creator: "Meta",
  creatorUrl: "https://huggingface.co/meta-llama",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "4096",
  blogUrl: "https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("llama3.2-vision:11b"), // "llama3-2-vision-11b"
  docs: generateChatCompletionsDocs("llama3.2-vision:11b", true)
},
{
  Name: "minicpm-v",
  Category: "vision",
  description: `\`MiniCPM-V 2.6\` is the latest and most capable model in the MiniCPM-V series. The model is built on SigLip-400M and Qwen2-7B with a total of 8B parameters. It exhibits a significant performance improvement over MiniCPM-Llama3-V 2.5, and introduces new features for multi-image and video understanding. Notable features of MiniCPM-V 2.6 include:

*   **🔥 Leading Performance**: MiniCPM-V 2.6 achieves an average score of 65.2 on the latest version of OpenCompass, a comprehensive evaluation over 8 popular benchmarks. With only 8B parameters, it surpasses widely used proprietary models like GPT-4o mini, GPT-4V, Gemini 1.5 Pro, and Claude 3.5 Sonnet for single image understanding.
*   **🖼️ Multi Image Understanding and In-context Learning**: MiniCPM-V 2.6 can also perform conversation and reasoning over multiple images. It achieves state-of-the-art performance on popular multi-image benchmarks such as Mantis-Eval, BLINK, Mathverse mv and Sciverse mv, and also shows promising in-context learning capability.
*   **💪 Strong OCR Capability**: MiniCPM-V 2.6 can process images with any aspect ratio and up to 1.8 million pixels (e.g., 1344x1344). It achieves state-of-the-art performance on OCRBench, surpassing proprietary models such as GPT-4o, GPT-4V, and Gemini 1.5 Pro. Based on the the latest RLAIF-V and VisCPM techniques, it features trustworthy behaviors, with significantly lower hallucination rates than GPT-4o and GPT-4V on Object HalBench, and supports multilingual capabilities on English, Chinese, German, French, Italian, Korean, etc.
*   **🚀 Superior Efficiency**: In addition to its friendly size, MiniCPM-V 2.6 also shows state-of-the-art token density (i.e., number of pixels encoded into each visual token). It produces only 640 tokens when processing a 1.8M pixel image, which is 75% fewer than most models. This directly improves the inference speed, first-token latency, memory usage, and power consumption.`,
  Creator: "openBMB",
  creatorUrl: "https://huggingface.co/openbmb",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "8192",
  blogUrl: "https://github.com/OpenBMB/MiniCPM-o",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("minicpm-v"), // "minicpm-v"
  docs: generateChatCompletionsDocs("minicpm-v", true)
},
{
  Name: "llava-llama3",
  Category: "vision",
  description: "`llava-llama-3-8b-v1_1` is a LLaVA model fine-tuned from `meta-llama/Meta-Llama-3-8B-Instruct` and `CLIP-ViT-Large-patch14-336` with ShareGPT4V-PT and InternVL-SFT by XTuner.",
  Creator: "xtuner",
  creatorUrl: "https://huggingface.co/xtuner",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k", // Assuming this is the same as minicpm-v based on structure, might need clarification
  outputLength: "4096",
  blogUrl: undefined, // No specific blog post listed, only HF link
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("llava-llama3"), // "llava-llama3"
  docs: generateChatCompletionsDocs("llava-llama3", true)
},
{
  Name: "moondream",
  Category: "vision",
  description: `\`Moondream\` is an open-source visual language model that understands images using simple text prompts. It's fast, wildly capable — and just 1GB in size.

*   **Vision AI at Warp Speed**: Forget everything you thought you needed to know about computer vision. With Moondream, there's no training, no ground truth data, and no heavy infrastructure. Just a model, a prompt, and a whole world of visual understanding.
*   **Ridiculously lightweight**: Under 2B parameters. Quantized to 4-bit. Just 1GB. Moondream runs anywhere — from edge devices to your laptop.
*   **Actually affordable**: Run it locally for free. Or use our cloud API to process a high volume of images quickly and cheaply. Free tier included.
*   **Simple by design**: Choose a capability. Write a prompt. Get results. That's it. Moondream is designed for developers who don't want to babysit models.
*   **Versatile as hell**: Go beyond basic visual Q&A. Moondream can caption, detect objects, locate things, read documents, follow gaze, and more.
*   **Tried, tested, trusted**: 6M+ downloads. 8K+ GitHub stars. Used across industries — from healthcare to robotics to mobile apps.`,
  Creator: "moondream",
  creatorUrl: "https://moondream.ai/",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: undefined, // Not specified in data
  outputLength: undefined, // Not specified in data
  blogUrl: "https://moondream.ai/blog/introducing-a-new-moondream-1-9b-and-gpu-support",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("moondream"), // "moondream"
  docs: generateChatCompletionsDocs("moondream", true) // Also potentially uses /m endpoints, but chat is primary interface
},
{
  Name: "granite3.2-vision",
  Category: "vision",
  description: "Model Summary: `granite-vision-3.2-2b` is a compact and efficient vision-language model, specifically designed for visual document understanding, enabling automated content extraction from tables, charts, infographics, plots, diagrams, and more. The model was trained on a meticulously curated instruction-following dataset, comprising diverse public datasets and synthetic datasets tailored to support a wide range of document understanding and general image tasks. It was trained by fine-tuning a Granite large language model with both image and text modalities.",
  Creator: "IBM",
  creatorUrl: "https://huggingface.co/ibm-granite",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: undefined, // Not specified in data
  outputLength: undefined, // Not specified in data
  blogUrl: "https://arxiv.org/abs/2502.09927",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("granite3.2-vision"), // "granite3-2-vision"
  docs: generateChatCompletionsDocs("granite3.2-vision", true)
},
 {
  Name: "mistral-small3.1",
  Category: "vision",
  description: `Model Card for Mistral-Small-3.1-24B-Instruct-2503 Building upon Mistral Small 3 (2501), Mistral Small 3.1 (2503) adds state-of-the-art vision understanding and enhances long context capabilities up to 128k tokens without compromising text performance. With 24 billion parameters, this model achieves top-tier capabilities in both text and vision tasks. This model is an instruction-finetuned version of: \`Mistral-Small-3.1-24B-Base-2503\`.

Mistral Small 3.1 can be deployed locally and is exceptionally "knowledge-dense," fitting within a single RTX 4090 or a 32GB RAM MacBook once quantized.

It is ideal for:

*   Fast-response conversational agents.
*   Low-latency function calling.
*   Subject matter experts via fine-tuning.
*   Local inference for hobbyists and organizations handling sensitive data.
*   Programming and math reasoning.
*   Long document understanding.
*   Visual understanding.

For enterprises requiring specialized capabilities (increased context, specific modalities, domain-specific knowledge, etc.), we will release commercial models beyond what Mistral AI contributes to the community.

Learn more about Mistral Small 3.1 in our [blog post](https://mistral.ai/news/mistral-small-3-1).

**Key Features**
*   **Vision**: Vision capabilities enable the model to analyze images and provide insights based on visual content in addition to text.
*   **Multilingual**: Supports dozens of languages, including English, French, German, Greek, Hindi, Indonesian, Italian, Japanese, Korean, Malay, Nepali, Polish, Portuguese, Romanian, Russian, Serbian, Spanish, Swedish, Turkish, Ukrainian, Vietnamese, Arabic, Bengali, Chinese, Farsi.
*   **Agent-Centric**: Offers best-in-class agentic capabilities with native function calling and JSON outputting.
*   **Advanced Reasoning**: State-of-the-art conversational and reasoning capabilities.
*   **Apache 2.0 License**: Open license allowing usage and modification for both commercial and non-commercial purposes.
*   **Context Window**: A 128k context window.
*   **System Prompt**: Maintains strong adherence and support for system prompts.
*   **Tokenizer**: Utilizes a Tekken tokenizer with a 131k vocabulary size.`,
  Creator: "Mistral",
  creatorUrl: "https://mistral.ai/",
  InputModalities: parseModalities("text, image"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "128k",
  blogUrl: "https://mistral.ai/news/mistral-small-3-1",
  vectorSize: undefined, // Not an embedding model
  slug: generateSlug("mistral-small3.1"), // "mistral-small3-1"
  docs: generateChatCompletionsDocs("mistral-small3.1", true)
},
{
  Name: "cogito:14b",
  Category: "text",
  description: `The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.

*   Cogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).
*   The LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.
*   The models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.
*   In both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.
*   Each model is trained in over 30 languages and supports a context length of 128k.`,
  Creator: "Cogito",
  creatorUrl: "https://www.deepcogito.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "128k",
  blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
  vectorSize: undefined,
  slug: generateSlug("cogito:14b"), // "cogito-14b"
  docs: generateChatCompletionsDocs("cogito:14b")
},
{
  Name: "cogito:32b",
  Category: "text",
  description: `The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.

*   Cogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).
*   The LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.
*   The models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.
*   In both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.
*   Each model is trained in over 30 languages and supports a context length of 128k.`,
  Creator: "Cogito",
  creatorUrl: "https://www.deepcogito.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "128k",
  blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
  vectorSize: undefined,
  slug: generateSlug("cogito:32b"), // "cogito-32b"
  docs: generateChatCompletionsDocs("cogito:32b")
},
{
  Name: "cogito:3b",
  Category: "text",
  description: `The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.

*   Cogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).
*   The LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.
*   The models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.
*   In both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.
*   Each model is trained in over 30 languages and supports a context length of 128k.`,
  Creator: "Cogito",
  creatorUrl: "https://www.deepcogito.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "128k",
  blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
  vectorSize: undefined,
  slug: generateSlug("cogito:3b"), // "cogito-3b"
  docs: generateChatCompletionsDocs("cogito:3b")
},
{
  Name: "cogito:70b",
  Category: "text",
  description: `The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.

*   Cogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).
*   The LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.
*   The models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.
*   In both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.
*   Each model is trained in over 30 languages and supports a context length of 128k.`,
  Creator: "Cogito",
  creatorUrl: "https://www.deepcogito.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "128k",
  blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
  vectorSize: undefined,
  slug: generateSlug("cogito:70b"), // "cogito-70b"
  docs: generateChatCompletionsDocs("cogito:70b")
},
{
  Name: "cogito:8b",
  Category: "text",
  description: `The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.

*   Cogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).
*   The LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.
*   The models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.
*   In both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.
*   Each model is trained in over 30 languages and supports a context length of 128k.`,
  Creator: "Cogito",
  creatorUrl: "https://www.deepcogito.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "128k",
  blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
  vectorSize: undefined,
  slug: generateSlug("cogito:8b"), // "cogito-8b"
  docs: generateChatCompletionsDocs("cogito:8b")
},
{
  Name: "deepseek-r1:1.5b",
  Category: "text",
  description: `\`DeepSeek R1 Distill Qwen 1.5B\` is a distilled large language model based on \`Qwen 2.5 Math 1.5B\`, using outputs from DeepSeek R1. It's a very small and efficient model which outperforms GPT 4o 0513 on Math Benchmarks.

Other benchmark results include:

*   AIME 2024 pass@1: 28.9
*   AIME 2024 cons@64: 52.7
*   MATH-500 pass@1: 83.9

The model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models.`,
  Creator: "Deepseek",
  creatorUrl: "https://www.deepseek.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "33k",
  blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
  vectorSize: undefined,
  slug: generateSlug("deepseek-r1:1.5b"), // "deepseek-r1-1-5b"
  docs: generateChatCompletionsDocs("deepseek-r1:1.5b")
},
{
  Name: "deepseek-r1:14b",
  Category: "text",
  description: `\`DeepSeek R1 Distill Qwen 14B\` is a distilled large language model based on Qwen 2.5 14B, using outputs from DeepSeek R1. It outperforms OpenAI's o1-mini across various benchmarks, achieving new state-of-the-art results for dense models.

Other benchmark results include:

*   AIME 2024 pass@1: 69.7
*   MATH-500 pass@1: 93.9
*   CodeForces Rating: 1481

The model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models.`,
  Creator: "Deepseek",
  creatorUrl: "https://www.deepseek.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "33k",
  blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
  vectorSize: undefined,
  slug: generateSlug("deepseek-r1:14b"), // "deepseek-r1-14b"
  docs: generateChatCompletionsDocs("deepseek-r1:14b")
},
{
  Name: "deepseek-r1:32b",
  Category: "text",
  description: `\`DeepSeek R1 Distill Qwen 32B\` is a distilled large language model based on Qwen 2.5 32B, using outputs from DeepSeek R1. It outperforms OpenAI's o1-mini across various benchmarks, achieving new state-of-the-art results for dense models.

Other benchmark results include:

*   AIME 2024 pass@1: 72.6
*   MATH-500 pass@1: 94.3
*   CodeForces Rating: 1691

The model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models.`,
  Creator: "Deepseek",
  creatorUrl: "https://www.deepseek.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "64k",
  blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
  vectorSize: undefined,
  slug: generateSlug("deepseek-r1:32b"), // "deepseek-r1-32b"
  docs: generateChatCompletionsDocs("deepseek-r1:32b")
},
{
  Name: "deepseek-r1:70b",
  Category: "text",
  description: `\`DeepSeek R1 Distill Llama 70B\` is a distilled large language model based on \`Llama-3.3-70B-Instruct\`, using outputs from DeepSeek R1. The model combines advanced distillation techniques to achieve high performance across multiple benchmarks, including:

*   AIME 2024 pass@1: 70.0
*   MATH-500 pass@1: 94.5
*   CodeForces Rating: 1633

The model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models.`,
  Creator: "Deepseek",
  creatorUrl: "https://www.deepseek.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "64k",
  blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
  vectorSize: undefined,
  slug: generateSlug("deepseek-r1:70b"), // "deepseek-r1-70b"
  docs: generateChatCompletionsDocs("deepseek-r1:70b")
},
{
  Name: "deepseek-r1:7b",
  Category: "text",
  description: "DeepSeek's first-generation of reasoning models with comparable performance to OpenAI-o1, including six dense models distilled from DeepSeek-R1 based on Llama and Qwen.", // Used short description as main one was empty
  Creator: "Deepseek",
  creatorUrl: "https://www.deepseek.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "33k",
  blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
  vectorSize: undefined,
  slug: generateSlug("deepseek-r1:7b"), // "deepseek-r1-7b"
  docs: generateChatCompletionsDocs("deepseek-r1:7b")
},
{
  Name: "deepseek-r1:8b",
  Category: "text",
  description: `\`DeepSeek R1 Distill Llama 8B\` is a distilled large language model based on \`Llama-3.1-8B-Instruct\`, using outputs from DeepSeek R1. The model combines advanced distillation techniques to achieve high performance across multiple benchmarks, including:

*   AIME 2024 pass@1: 50.4
*   MATH-500 pass@1: 89.1
*   CodeForces Rating: 1205

The model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models.`,
  Creator: "Deepseek",
  creatorUrl: "https://www.deepseek.com/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "33k",
  blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
  vectorSize: undefined,
  slug: generateSlug("deepseek-r1:8b"), // "deepseek-r1-8b"
  docs: generateChatCompletionsDocs("deepseek-r1:8b")
},
 {
  Name: "llama3.1:8b",
  Category: "text",
  description: "The Meta Llama 3.1 collection of multilingual large language models (LLMs) is a collection of pretrained and instruction tuned generative models in 8B, 70B and 405B sizes (text in/text out). The Llama 3.1 instruction tuned text only models (8B, 70B, 405B) are optimized for multilingual dialogue use cases and outperform many of the available open source and closed chat models on common industry benchmarks.",
  Creator: "Meta",
  creatorUrl: "https://huggingface.co/meta-llama",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "16k",
  blogUrl: "https://ai.meta.com/blog/meta-llama-3-1/",
  vectorSize: undefined,
  slug: generateSlug("llama3.1:8b"), // "llama3-1-8b"
  docs: generateChatCompletionsDocs("llama3.1:8b")
},
{
  Name: "llama3.2:1b",
  Category: "text",
  description: "The Meta Llama 3.2 collection of multilingual large language models (LLMs) is a collection of pretrained and instruction-tuned generative models in 1B and 3B sizes (text in/text out). The Llama 3.2 instruction-tuned text only models are optimized for multilingual dialogue use cases, including agentic retrieval and summarization tasks. They outperform many of the available open source and closed chat models on common industry benchmarks.",
  Creator: "Meta",
  creatorUrl: "https://huggingface.co/meta-llama",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "8k",
  blogUrl: "https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/",
  vectorSize: undefined,
  slug: generateSlug("llama3.2:1b"), // "llama3-2-1b"
  docs: generateChatCompletionsDocs("llama3.2:1b")
},
{
  Name: "llama3.2:3b",
  Category: "text",
  description: "The Meta Llama 3.2 collection of multilingual large language models (LLMs) is a collection of pretrained and instruction-tuned generative models in 1B and 3B sizes (text in/text out). The Llama 3.2 instruction-tuned text only models are optimized for multilingual dialogue use cases, including agentic retrieval and summarization tasks. They outperform many of the available open source and closed chat models on common industry benchmarks.",
  Creator: "Meta",
  creatorUrl: "https://huggingface.co/meta-llama",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "8k",
  blogUrl: "https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/",
  vectorSize: undefined,
  slug: generateSlug("llama3.2:3b"), // "llama3-2-3b"
  docs: generateChatCompletionsDocs("llama3.2:3b")
},
{
  Name: "llama3.3",
  Category: "text",
  description: `The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out). The Llama 3.3 instruction tuned text only model is optimized for multilingual dialogue use cases and outperforms many of the available open source and closed chat models on common industry benchmarks.

**Supported languages**: English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai.`,
  Creator: "Meta",
  creatorUrl: "https://huggingface.co/meta-llama",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "16k",
  blogUrl: "https://ai.meta.com/blog/future-of-ai-built-with-llama/",
  vectorSize: undefined,
  slug: generateSlug("llama3.3"), // "llama3-3"
  docs: generateChatCompletionsDocs("llama3.3")
},
{
  Name: "mistral",
  Category: "text",
  description: `Mistral is a 7B parameter model, distributed with the Apache license. It is available in both instruct (instruction following) and text completion.

The Mistral AI team has noted that Mistral 7B:

*   Outperforms Llama 2 13B on all benchmarks
*   Outperforms Llama 1 34B on many benchmarks
*   Approaches CodeLlama 7B performance on code, while remaining good at English tasks`,
  Creator: "Mistral",
  creatorUrl: "https://huggingface.co/mistralai",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "33k", // Updated based on newer Mistral info, spreadsheet had 32k
  outputLength: "8k",
  blogUrl: "https://mistral.ai/news/announcing-mistral-7b",
  vectorSize: undefined,
  slug: generateSlug("mistral"), // "mistral"
  docs: generateChatCompletionsDocs("mistral")
},
{
  Name: "mistral-nemo",
  Category: "text",
  description: "Mistral NeMo is a 12B model built in collaboration with NVIDIA. Mistral NeMo offers a large context window of up to 128k tokens. Its reasoning, world knowledge, and coding accuracy are state-of-the-art in its size category. As it relies on standard architecture, Mistral NeMo is easy to use and a drop-in replacement in any system using Mistral 7B.",
  Creator: "Mistral",
  creatorUrl: "https://mistral.ai/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "16k",
  blogUrl: "https://mistral.ai/news/mistral-nemo",
  vectorSize: undefined,
  slug: generateSlug("mistral-nemo"), // "mistral-nemo"
  docs: generateChatCompletionsDocs("mistral-nemo")
},
{
  Name: "phi4",
  Category: "text",
  description: `\`phi-4\` is a state-of-the-art open model built upon a blend of synthetic datasets, data from filtered public domain websites, and acquired academic books and Q&A datasets. The goal of this approach was to ensure that small capable models were trained with data focused on high quality and advanced reasoning.

\`phi-4\` underwent a rigorous enhancement and alignment process, incorporating both supervised fine-tuning and direct preference optimization to ensure precise instruction adherence and robust safety measures.`,
  Creator: "Microsoft",
  creatorUrl: "https://huggingface.co/microsoft",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "16k", // Data seems inconsistent, using the lower value mentioned
  outputLength: "8k",
  blogUrl: "https://arxiv.org/pdf/2412.08905",
  vectorSize: undefined,
  slug: generateSlug("phi4"), // "phi4"
  docs: generateChatCompletionsDocs("phi4")
},
{
  Name: "phi4-mini",
  Category: "text",
  description: "`Phi-4-mini-instruct` is a lightweight open model built upon synthetic data and filtered publicly available websites - with a focus on high-quality, reasoning dense data. The model belongs to the Phi-4 model family and supports 128K token context length. The model underwent an enhancement process, incorporating both supervised fine-tuning and direct preference optimization to support precise instruction adherence and robust safety measures",
  Creator: "Microsoft",
  creatorUrl: "https://huggingface.co/microsoft",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "128k",
  blogUrl: "http://techcommunity.microsoft.com/blog/educatordeveloperblog/welcome-to-the-new-phi-4-models---microsoft-phi-4-mini--phi-4-multimodal/4386037",
  vectorSize: undefined,
  slug: generateSlug("phi4-mini"), // "phi4-mini"
  docs: generateChatCompletionsDocs("phi4-mini")
},
{
  Name: "qwen2.5:14b",
  Category: "text",
  description: `\`Qwen2.5\` is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:

*   It possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.
*   It demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.
*   It supports long contexts of up to 128K tokens and can generate up to 8K tokens.
*   It offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more.`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5:14b"), // "qwen2-5-14b"
  docs: generateChatCompletionsDocs("qwen2.5:14b")
},
{
  Name: "qwen2.5:32b",
  Category: "text",
  description: `\`Qwen2.5\` is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:

*   It possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.
*   It demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.
*   It supports long contexts of up to 128K tokens and can generate up to 8K tokens.
*   It offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more.`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5:32b"), // "qwen2-5-32b"
  docs: generateChatCompletionsDocs("qwen2.5:32b")
},
{
  Name: "qwen2.5:72b",
  Category: "text",
  description: `\`Qwen2.5\` is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:

*   It possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.
*   It demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.
*   It supports long contexts of up to 128K tokens and can generate up to 8K tokens.
*   It offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more.`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5:72b"), // "qwen2-5-72b"
  docs: generateChatCompletionsDocs("qwen2.5:72b")
},
{
  Name: "qwen2.5:7b",
  Category: "text",
  description: `\`Qwen2.5\` is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:

*   It possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.
*   It demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.
*   It supports long contexts of up to 128K tokens and can generate up to 8K tokens.
*   It offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more.`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5:7b"), // "qwen2-5-7b"
  docs: generateChatCompletionsDocs("qwen2.5:7b")
},
{
  Name: "qwq",
  Category: "text",
  description: "`QwQ` is the reasoning model of the Qwen series. Compared with conventional instruction-tuned models, QwQ, which is capable of thinking and reasoning, can achieve significantly enhanced performance in downstream tasks, especially hard problems. `QwQ-32B` is the medium-sized reasoning model, which is capable of achieving competitive performance against state-of-the-art reasoning models, e.g., DeepSeek-R1, o1-mini.",
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "131k",
  blogUrl: "https://qwenlm.github.io/blog/qwq-32b/",
  vectorSize: undefined,
  slug: generateSlug("qwq"), // "qwq"
  docs: generateChatCompletionsDocs("qwq")
},
{
  Name: "mathstral",
  Category: "math",
  description: `Mistral AI is contributing Mathstral to the science community to bolster efforts in advanced mathematical problems requiring complex, multi-step logical reasoning. The Mathstral release is part of their broader effort to support academic projects—it was produced in the context of Mistral AI’s collaboration with Project Numina.

Akin to Isaac Newton in his time, Mathstral stands on the shoulders of Mistral 7B and specializes in STEM subjects. It achieves state-of-the-art reasoning capacities in its size category across various industry-standard benchmarks.`,
  Creator: "Mistral",
  creatorUrl: "https://mistral.ai/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "32k",
  outputLength: undefined, // Not specified in data
  blogUrl: "https://mistral.ai/news/mathstral",
  vectorSize: undefined,
  slug: generateSlug("mathstral"), // "mathstral"
  docs: generateChatCompletionsDocs("mathstral")
},
{
  Name: "qwen2-math:7b",
  Category: "math",
  description: "Over the past year, we have dedicated significant effort to researching and enhancing the reasoning capabilities of large language models, with a particular focus on their ability to solve arithmetic and mathematical problems. Today, we are delighted to introduce a series of math-specific large language models of our Qwen2 series, `Qwen2-Math` and `Qwen2-Math-Instruct-1.5B/7B/72B`. Qwen2-Math is a series of specialized math language models built upon the Qwen2 LLMs, which significantly outperforms the mathematical capabilities of open-source models and even closed-source models (e.g., GPT-4o). We hope that Qwen2-Math can contribute to the community for solving complex mathematical problems.",
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "4k",
  outputLength: "2k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2-math/",
  vectorSize: undefined,
  slug: generateSlug("qwen2-math:7b"), // "qwen2-math-7b"
  docs: generateChatCompletionsDocs("qwen2-math:7b")
},
{
  Name: "qwen2-math:72b",
  Category: "math",
  description: "Over the past year, we have dedicated significant effort to researching and enhancing the reasoning capabilities of large language models, with a particular focus on their ability to solve arithmetic and mathematical problems. Today, we are delighted to introduce a series of math-specific large language models of our Qwen2 series, `Qwen2-Math` and `Qwen2-Math-Instruct-1.5B/7B/72B`. Qwen2-Math is a series of specialized math language models built upon the Qwen2 LLMs, which significantly outperforms the mathematical capabilities of open-source models and even closed-source models (e.g., GPT-4o). We hope that Qwen2-Math can contribute to the community for solving complex mathematical problems.",
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "4k",
  outputLength: "2k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2-math/",
  vectorSize: undefined,
  slug: generateSlug("qwen2-math:72b"), // "qwen2-math-72b"
  docs: generateChatCompletionsDocs("qwen2-math:72b")
},
{
  Name: "deepscaler",
  Category: "math",
  description: `🚀 Democratizing Reinforcement Learning for LLMs 🌟

\`DeepScaleR-1.5B-Preview\` is a language model fine-tuned from \`DeepSeek-R1-Distilled-Qwen-1.5B\` using distributed reinforcement learning (RL) to scale up to long context lengths. The model achieves 43.1% Pass@1 accuracy on AIME 2024, representing a 15% improvement over the base model (28.8%) and surpassing OpenAI’s O1-Preview performance with just 1.5B parameters.`,
  Creator: "Agentica",
  creatorUrl: "https://huggingface.co/agentica-org",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "32k",
  outputLength: "8k",
  blogUrl: "https://pretty-radio-b75.notion.site/DeepScaleR-Surpassing-O1-Preview-with-a-1-5B-Model-by-Scaling-RL-19681902c1468005bed8ca303013a4e2",
  vectorSize: undefined,
  slug: generateSlug("deepscaler"), // "deepscaler"
  docs: generateChatCompletionsDocs("deepscaler")
},
 {
  Name: "qwen2.5-coder:3b",
  Category: "code",
  description: `**Powerful**: \`Qwen2.5-Coder-32B-Instruct\` has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;
**Diverse**: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;
**Practical**: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "32k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5-coder:3b"), // "qwen2-5-coder-3b"
  docs: generateChatCompletionsDocs("qwen2.5-coder:3b")
},
{
  Name: "qwen2.5-coder:7b",
  Category: "code",
  description: `**Powerful**: \`Qwen2.5-Coder-32B-Instruct\` has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;
**Diverse**: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;
**Practical**: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "131k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5-coder:7b"), // "qwen2-5-coder-7b"
  docs: generateChatCompletionsDocs("qwen2.5-coder:7b")
},
{
  Name: "qwen2.5-coder:14b",
  Category: "code",
  description: `**Powerful**: \`Qwen2.5-Coder-32B-Instruct\` has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;
**Diverse**: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;
**Practical**: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5-coder:14b"), // "qwen2-5-coder-14b"
  docs: generateChatCompletionsDocs("qwen2.5-coder:14b")
},
{
  Name: "qwen2.5-coder:32b",
  Category: "code",
  description: `**Powerful**: \`Qwen2.5-Coder-32B-Instruct\` has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;
**Diverse**: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;
**Practical**: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios`,
  Creator: "Qwen",
  creatorUrl: "https://qwenlm.github.io/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
  vectorSize: undefined,
  slug: generateSlug("qwen2.5-coder:32b"), // "qwen2-5-coder-32b"
  docs: generateChatCompletionsDocs("qwen2.5-coder:32b")
},
{
  Name: "deepcoder:14b",
  Category: "code",
  description: "`DeepCoder-14B-Preview` is a code reasoning LLM fine-tuned from `DeepSeek-R1-Distilled-Qwen-14B` using distributed reinforcement learning (RL) to scale up to long context lengths. The model achieves 60.6% Pass@1 accuracy on LiveCodeBench v5 (8/1/24-2/1/25), representing a 8% improvement over the base model (53%) and achieving similar performance to OpenAI's o3-mini with just 14B parameters.",
  Creator: "Agentica",
  creatorUrl: "https://huggingface.co/agentica-org/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://pretty-radio-b75.notion.site/DeepCoder-A-Fully-Open-Source-14B-Coder-at-O3-mini-Level-1cf81902c14680b3bee5eb349a512a51",
  vectorSize: undefined,
  slug: generateSlug("deepcoder:14b"), // "deepcoder-14b"
  docs: generateChatCompletionsDocs("deepcoder:14b")
},
{
  Name: "codegemma:2b",
  Category: "code",
  description: "`CodeGemma` is a collection of powerful, lightweight models that can perform a variety of coding tasks like fill-in-the-middle code completion, code generation, natural language understanding, mathematical reasoning, and instruction following.",
  Creator: "Google",
  creatorUrl: "https://huggingface.co/google/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "8k",
  outputLength: "4k",
  blogUrl: "https://arxiv.org/abs/2406.11409",
  vectorSize: undefined,
  slug: generateSlug("codegemma:2b"), // "codegemma-2b"
  docs: generateChatCompletionsDocs("codegemma:2b")
},
{
  Name: "codegemma:7b",
  Category: "code",
  description: "`CodeGemma` is a collection of powerful, lightweight models that can perform a variety of coding tasks like fill-in-the-middle code completion, code generation, natural language understanding, mathematical reasoning, and instruction following.",
  Creator: "Google",
  creatorUrl: "https://huggingface.co/google/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "8k",
  outputLength: "4k",
  blogUrl: "https://arxiv.org/abs/2406.11410",
  vectorSize: undefined,
  slug: generateSlug("codegemma:7b"), // "codegemma-7b"
  docs: generateChatCompletionsDocs("codegemma:7b")
},
{
  Name: "deepseek-coder:1.3b",
  Category: "code",
  description: `\`Deepseek Coder\` is composed of a series of code language models, each trained from scratch on 2T tokens, with a composition of 87% code and 13% natural language in both English and Chinese. We provide various sizes of the code model, ranging from 1B to 33B versions. Each model is pre-trained on project-level code corpus by employing a window size of 16K and a extra fill-in-the-blank task, to support project-level code completion and infilling. For coding capabilities, Deepseek Coder achieves state-of-the-art performance among open-source code models on multiple programming languages and various benchmarks.

*   **Massive Training Data**: Trained from scratch on 2T tokens, including 87% code and 13% linguistic data in both English and Chinese languages.
*   **Highly Flexible & Scalable**: Offered in model sizes of 1.3B, 5.7B, 6.7B, and 33B, enabling users to choose the setup most suitable for their requirements.
*   **Superior Model Performance**: State-of-the-art performance among publicly available code models on HumanEval, MultiPL-E, MBPP, DS-1000, and APPS benchmarks.
*   **Advanced Code Completion Capabilities**: A window size of 16K and a fill-in-the-blank task, supporting project-level code completion and infilling tasks.`,
  Creator: "Deepseek",
  creatorUrl: "https://huggingface.co/deepseek-ai/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "16k",
  outputLength: undefined, // Not specified in data
  blogUrl: "https://deepseekcoder.github.io/",
  vectorSize: undefined,
  slug: generateSlug("deepseek-coder:1.3b"), // "deepseek-coder-1-3b"
  docs: generateChatCompletionsDocs("deepseek-coder:1.3b")
},
{
  Name: "deepseek-coder:6.7b",
  Category: "code",
  description: `\`Deepseek Coder\` is composed of a series of code language models, each trained from scratch on 2T tokens, with a composition of 87% code and 13% natural language in both English and Chinese. We provide various sizes of the code model, ranging from 1B to 33B versions. Each model is pre-trained on project-level code corpus by employing a window size of 16K and a extra fill-in-the-blank task, to support project-level code completion and infilling. For coding capabilities, Deepseek Coder achieves state-of-the-art performance among open-source code models on multiple programming languages and various benchmarks.

*   **Massive Training Data**: Trained from scratch on 2T tokens, including 87% code and 13% linguistic data in both English and Chinese languages.
*   **Highly Flexible & Scalable**: Offered in model sizes of 1.3B, 5.7B, 6.7B, and 33B, enabling users to choose the setup most suitable for their requirements.
*   **Superior Model Performance**: State-of-the-art performance among publicly available code models on HumanEval, MultiPL-E, MBPP, DS-1000, and APPS benchmarks.
*   **Advanced Code Completion Capabilities**: A window size of 16K and a fill-in-the-blank task, supporting project-level code completion and infilling tasks.`,
  Creator: "Deepseek",
  creatorUrl: "https://huggingface.co/deepseek-ai/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "16k",
  outputLength: undefined, // Not specified in data
  blogUrl: "https://deepseekcoder.github.io/",
  vectorSize: undefined,
  slug: generateSlug("deepseek-coder:6.7b"), // "deepseek-coder-6-7b"
  docs: generateChatCompletionsDocs("deepseek-coder:6.7b")
},
{
  Name: "deepseek-coder-v2:16b",
  Category: "code",
  description: "We present \`DeepSeek-Coder-V2\`, an open-source Mixture-of-Experts (MoE) code language model that achieves performance comparable to GPT4-Turbo in code-specific tasks. Specifically, DeepSeek-Coder-V2 is further pre-trained from an intermediate checkpoint of DeepSeek-V2 with additional 6 trillion tokens. Through this continued pre-training, DeepSeek-Coder-V2 substantially enhances the coding and mathematical reasoning capabilities of DeepSeek-V2, while maintaining comparable performance in general language tasks. Compared to DeepSeek-Coder-33B, DeepSeek-Coder-V2 demonstrates significant advancements in various aspects of code-related tasks, as well as reasoning and general capabilities. Additionally, DeepSeek-Coder-V2 expands its support for programming languages from 86 to 338, while extending the context length from 16K to 128K.",
  Creator: "Deepseek",
  creatorUrl: "https://huggingface.co/deepseek-ai/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: undefined, // Not specified in data
  blogUrl: "https://deepseekcoder.github.io/",
  vectorSize: undefined,
  slug: generateSlug("deepseek-coder-v2:16b"), // "deepseek-coder-v2-16b"
  docs: generateChatCompletionsDocs("deepseek-coder-v2:16b")
},
{
  Name: "stable diffusion 2.1",
  Category: "image",
  description: "A latent text-to-image diffusion model capable of generating photo-realistic images given any text input.",
  Creator: "Stable Diffusion",
  creatorUrl: "https://huggingface.co/stabilityai/stable-diffusion-2-1", // Using HF as creator URL
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("image"),
  contextSize: undefined, // N/A for image models
  outputLength: undefined, // N/A for image models
  blogUrl: undefined, // No blog post listed
  vectorSize: undefined,
  slug: generateSlug("stable diffusion 2.1"), // "stable-diffusion-2-1"
  docs: generateImageDocs("stable diffusion 2.1")
},
{
  Name: "kokoro-82m",
  Category: "audio",
  description: "`Kokoro` is an open-weight TTS model with 82 million parameters. Despite its lightweight architecture, it delivers comparable quality to larger models while being significantly faster and more cost-efficient. With Apache-licensed weights, Kokoro can be deployed anywhere from production environments to personal projects.",
  Creator: "Hexgrad",
  creatorUrl: "https://huggingface.co/hexgrad",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("voice"), // Changed to 'voice' to match description
  contextSize: undefined, // N/A for TTS
  outputLength: undefined, // N/A for TTS
  blogUrl: undefined, // No blog post listed, HF page linked in creatorUrl
  vectorSize: undefined,
  slug: generateSlug("kokoro-82m"), // "kokoro-82m"
  docs: generateTtsDocs("kokoro-82m")
},
{
  Name: "Wan-AI/Wan2.1-T2V-1.3B",
  Category: "video",
  description: `\`Wan2.1\`, a comprehensive and open suite of video foundation models that pushes the boundaries of video generation. Wan2.1 offers these key features:

*   👍 **SOTA Performance**: Wan2.1 consistently outperforms existing open-source models and state-of-the-art commercial solutions across multiple benchmarks.
*   👍 **Supports Consumer-grade GPUs**: The T2V-1.3B model requires only 8.19 GB VRAM, making it compatible with almost all consumer-grade GPUs. It can generate a 5-second 480P video on an RTX 4090 in about 4 minutes (without optimization techniques like quantization). Its performance is even comparable to some closed-source models.
*   👍 **Multiple Tasks**: Wan2.1 excels in Text-to-Video, Image-to-Video, Video Editing, Text-to-Image, and Video-to-Audio, advancing the field of video generation.
*   👍 **Visual Text Generation**: Wan2.1 is the first video model capable of generating both Chinese and English text, featuring robust text generation that enhances its practical applications.`,
  Creator: "Wan AI",
  creatorUrl: "https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B", // Using HF as creator URL
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("video"),
  contextSize: undefined, // N/A for video models
  outputLength: undefined, // N/A for video models
  blogUrl: undefined, // No blog post listed
  vectorSize: undefined,
  slug: generateSlug("Wan-AI/Wan2.1-T2V-1.3B"), // "wan-ai-wan2-1-t2v-1-3b"
  docs: generateVideoDocs("Wan-AI/Wan2.1-T2V-1.3B")
},
{
  Name: "granite3.3:8b",
  Category: "text",
  description: "The IBM Granite 3.3 8B model is an 8-billion-parameter instruction-tuned LLM with a 128K token context window, optimized for reasoning, instruction following, fill-in-the-middle code completion, and structured reasoning.",
  Creator: "IBM",
  creatorUrl: "https://www.ibm.com/granite/docs/models/granite/",
  InputModalities: parseModalities("text"),
  OutputModalities: parseModalities("text"),
  contextSize: "128k",
  outputLength: "8k",
  blogUrl: "https://www.ibm.com/granite/docs/models/granite/",
  slug: generateSlug("granite3.3:8b"),
  docs: generateChatCompletionsDocs("granite3.3:8b")
},
];

interface EndpointDoc{
  route: string;
  docs: string;
}

export const endpoints: EndpointDoc[] = [
  {
    route: "/api/v1/embeddings",
    docs: `
## Endpoint \`POST /api/v1/embeddings\`

Generate vector-embeddings through your decentralized compute network.
The central **Next .js App Router** accepts the request, selects a healthy Ollama provider node (running in a Tauri side-car), forwards the call, rewards the provider, and streams the response back.

---

### 1  URL

\`\`\`
POST https://<your-orchestrator-host>/api/v1/embeddings
\`\`\`

---

### 2  Pre-flight (CORS)

\`\`\`
OPTIONS /api/v1/embeddings
\`\`\`

| Header | Value |
|--------|-------|
| Access-Control-Allow-Origin | \`*\` |
| Access-Control-Allow-Headers | \`Content-Type, Authorization, X-User-Id, X-Title, HTTP-Referer\` |
| Access-Control-Allow-Methods | \`POST, OPTIONS\` |

---

### 3  Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| **Authorization** | ✓ | \`Bearer <API_KEY>\` – your issued API key. |
| **X-User-Id** | ✓ | Internal user / customer identifier used for metering. |
| **X-Title** | — | Friendly service / product name (used for per-service analytics). |
| **HTTP-Referer** | — | Originating page URL (captured for analytics). |
| **Content-Type** | ✓ | \`application/json\` |

---

### 4  Request Body

\`\`\`jsonc
{
  "model":        "string",            // e.g. "nomic-embed-text"
  "input":        "string|string[]",   // plain text or array of texts
  "truncate":     true|false,          // optional – whether to truncate long inputs
  "keep_alive":   "2h" | 3600,         // optional – keep model weights hot
  // Any additional Ollama runtime options are also accepted:
  "temperature":  0.0,
  "repeat_penalty": 1.1
}
\`\`\`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| \`model\` | \`string\` | ✓ | Name of an embeddings-capable Ollama model available on the network. |
| \`input\` | \`string\` or \`string[]\` | ✓ | One or more texts to embed. |
| \`truncate\` | \`boolean\` | — | If \`true\`, long inputs are truncated instead of erroring. |
| \`keep_alive\` | \`string\` \\| \`number\` | — | Duration to keep the model loaded (\`"30m"\`, \`"2h"\`, or seconds). |
| _…any other key_ | \`any\` | — | Passed straight through to Ollama; use to tune runtime (e.g. \`temperature\`). |

---

### 5  Successful Response \`200 OK\`

\`\`\`jsonc
{
  "model": "nomic-embed-text",
  "embeddings": [[0.019, -0.023, … ], …],
  "total_duration": 842,      // ms – wall-clock
  "load_duration": 337,       // ms – model load if cold
  "prompt_eval_count": 1
}
\`\`\`

| Field | Type | Description |
|-------|------|-------------|
| \`model\` | \`string\` | Echo of the model used. |
| \`embeddings\` | \`number[][]\` | Array of embedding vectors (one per input). |
| \`total_duration\` | \`number\` | End-to-end time on the provider in ms. |
| \`load_duration\` | \`number\` | Time spent loading the model (0 if already resident). |
| \`prompt_eval_count\` | \`number\` | Tokens processed internally by Ollama. |

The response is returned with \`Content-Type: application/json\` and \`Access-Control-Allow-Origin: *\`.

---

### 6  Error Responses

| HTTP status | JSON shape | When it happens |
|-------------|------------|-----------------|
| **400** | \`{ "error": "Missing required parameter: model, input" }\` | \`model\` or \`input\` missing. |
| **401** | \`{ "error": "Invalid API key" }\` | Bad or absent \`Authorization\` header. |
| **503** | \`{ "error": "No healthy embeddings provision found" }\` | All provider nodes failed health-checks. |
| **500** | \`{ "error": "Internal server error" }\` | Unhandled exception in router. |
| **> =502** (proxy) | \`{ "error": "Node error: …" }\` | Provider node replied non-200; message forwarded. |

---

### 7  End-to-End Flow (internals)

1. **Validate key** – credits check via \`validateApiKey\`.
2. **Choose provider** – \`selectEmbeddingsProvision(model)\` → returns \`{ provisionEndpoint, providerId, provisionId }\`. Health-checked up to 3 times; dead nodes are deregistered.
3. **Forward request** – JSON envelope is POSTed to \`http://<node>/embeddings\`.
4. **Measure latency** – total router → node → router time (plus node’s \`load_duration\`).
5. **Record metrics** – \`updateEmbeddingsMetadata\`, \`updateEmbeddingsServiceMetadata\`.
6. **Reward provider** – micro-payment \`rewardProvider(providerId, 0.01)\`.
7. **Return response** – passthrough of Ollama JSON plus CORS headers.

*These internals are purely informational; client code only sees the public contract.*

---

### 8  Example cURL

\`\`\`bash
curl https://api.my-net.io/api/v1/embeddings \\
  -H "Authorization: Bearer sk-live-abc123" \\
  -H "X-User-Id: user_42" \\
  -H "Content-Type: application/json" \\
  -d '{
        "model":"nomic-embed-text",
        "input":["Hello, world!", "Second sentence."],
        "truncate":false,
        "keep_alive":"30m"
      }'
\`\`\`

---

### 9  OpenAPI (YAML snippet)

\`\`\`yaml
paths:
  /api/v1/embeddings:
    post:
      summary: Generate text embeddings
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EmbeddingsRequest'
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EmbeddingsResponse'
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
        '500': { $ref: '#/components/responses/InternalError' }

components:
  schemas:
    EmbeddingsRequest:
      type: object
      required: [model, input]
      properties:
        model: { type: string }
        input: { oneOf: [{ type: string }, { type: array, items: { type: string } }] }
        truncate: { type: boolean }
        keep_alive: { oneOf: [{ type: string }, { type: number }] }
        # Additional properties allowed
      additionalProperties: true
    EmbeddingsResponse:
      type: object
      properties:
        model: { type: string }
        embeddings:
          type: array
          items:
            type: array
            items: { type: number }
        total_duration: { type: number }
        load_duration: { type: number }
        prompt_eval_count: { type: number }
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
\`\`\`

---

### 10  Provider-Node Endpoint (for reference only)

\`\`\`
POST http://<node-host>:<port>/embeddings
\`\`\`

Body and response signatures are identical to the public endpoint; authentication is not required because all calls originate from the orchestrator.

---

### 11  Changelog

| Date (UTC) | Change |
|------------|--------|
| 2025-04-26 | Initial specification drafted. |

---

> **Next step:** Let me know which endpoint you’d like to document next (e.g., \`/api/v1/completions\`, health probes, credits, etc.), or if you prefer the docs exported in another format (HTML, PDF, full OpenAPI file, etc.).
`
  },
  {
    route: "/api/v1/video",
    docs: `
## Endpoint \`POST /api/v1/video\`

Turn a text prompt into an **MP4 video** via your decentralized media-model network.
The Next .js router validates the request, selects a healthy “Wan T2V” provider node, streams the MP4 back, and rewards the node.

---

### 1  URL

\`\`\`
POST https://<orchestrator-host>/api/v1/video
\`\`\`

---

### 2  Pre-flight (CORS)

\`\`\`
OPTIONS /api/v1/video
\`\`\`

| Header | Value |
|--------|-------|
| Access-Control-Allow-Origin | \`*\` |
| Access-Control-Allow-Headers | \`Content-Type, Authorization, X-User-Id, X-Title, HTTP-Referer\` |
| Access-Control-Allow-Methods | \`POST, OPTIONS\` |

---

### 3  Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| **Authorization** | ✓ | \`Bearer <API_KEY>\` |
| **X-User-Id** | ✓ | Internal user identifier for metering / quotas. |
| **X-Title** | — | Service name for per-service analytics. |
| **HTTP-Referer** | — | Originating page URL. |
| **Content-Type** | ✓ | \`application/json\` |

---

### 4  Request Body

\`\`\`jsonc
{
  "prompt":              "Two cats boxing on a stage",   // required
  "size":                "832*480",                      // required (width*height)
  "ckpt_dir":            "./Wan2.1-T2V-1.3B",            // optional – overrides default model dir
  "sample_shift":        8,                              // optional int
  "sample_guide_scale":  6,                              // optional float
  "offload_model":       true,                           // optional – CPU/GPU memory trade-off
  "t5_cpu":              true,                           // optional – run text encoder on CPU
  // …any other CLI flags your generate.py supports
}
\`\`\`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| \`prompt\` | \`string\` | ✓ | Text description of the desired clip. |
| \`size\` | \`string\` | ✓ | Resolution in \`<width>*<height>\` format (e.g. \`832*480\`). |
| \`ckpt_dir\` | \`string\` | — | Absolute/relative path to a Wan T2V checkpoint; defaults to the node’s configured model. |
| \`sample_shift\` | \`integer\` | — | Temporal sampling offset. |
| \`sample_guide_scale\` | \`number\` | — | Classifier-free guidance strength. |
| \`offload_model\` | \`boolean\` | — | Off-loads non-active layers to RAM or disk. |
| \`t5_cpu\` | \`boolean\` | — | Runs the T5 text encoder on CPU to free GPU VRAM. |
| _…any other key_ | \`any\` | — | Passed straight through to the provider’s \`generate.py\`. |

---

### 5  Successful Response \`200 OK\`

*Binary stream* – an MP4 file.

| Header | Value |
|--------|-------|
| \`Content-Type\` | \`video/mp4\` |
| \`Access-Control-Allow-Origin\` | \`*\` |

> The body is a **streaming MP4**; consume it as a file/pipe, not JSON.

---

### 6  Error Responses

| HTTP status | JSON body | Cause |
|-------------|-----------|-------|
| **400** | \`{ "error": "Missing required fields \\"prompt\\" and \\"size\\"." }\` | \`prompt\` or \`size\` not supplied. |
| **401** | \`{ "error": "Invalid API key" }\` | Bad or absent \`Authorization\`. |
| **503** | \`{ "error": "No healthy video provision found" }\` | All provider nodes failed health-checks. |
| **500** | \`{ "error": "Internal server error" }\` | Unhandled exception in router. |
| **502-504** | \`{ "error": "Node error: …" }\` | Provider returned non-200; message forwarded verbatim. |

---

### 7  Example cURL

\`\`\`bash
curl https://api.my-net.io/api/v1/video \\
  -H "Authorization: Bearer sk-live-abc123" \\
  -H "X-User-Id: user_42" \\
  -H "Content-Type: application/json" \\
  --output boxing_cats.mp4 \\
  -d '{
        "prompt":"Two cats boxing on a stage",
        "size":"832*480",
        "sample_guide_scale":6,
        "offload_model":true
      }'
\`\`\`

---

### 8  OpenAPI Snippet

\`\`\`yaml
paths:
  /api/v1/video:
    post:
      summary: Generate an MP4 video from a text prompt
      operationId: createVideo
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/VideoRequest'
      responses:
        '200':
          description: MP4 stream
          content:
            video/mp4: {}
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
        '500': { $ref: '#/components/responses/InternalError' }

components:
  schemas:
    VideoRequest:
      type: object
      required: [prompt, size]
      properties:
        prompt: { type: string }
        size:   { type: string, pattern: '^[0-9]+\\\\*[0-9]+$' } # Escaped backslash for pattern
        ckpt_dir: { type: string }
        sample_shift: { type: integer }
        sample_guide_scale: { type: number }
        offload_model: { type: boolean }
        t5_cpu: { type: boolean }
      additionalProperties: true
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
\`\`\`

---

### 9  Internal Flow (router → node)

1. **Key validation** \`validateApiKey\`.
2. **Node selection** \`selectVideoProvision("wan2.1")\` + health probe (max 3 attempts).
3. **Forward** to \`http://<node>/video\` with the same JSON body.
4. **Provider** runs \`python generate.py …\` and writes an MP4 to disk.
5. **Stream** MP4 back through the router (\`Response(nodeResp.body, { "Content-Type": "video/mp4" })\`).
6. **Metrics** \`updateVideoMetadata(latency)\` and (optionally) \`updateVideoServiceMetadata\`.
7. **Reward** node owner \`rewardProvider(providerId, 0.01)\`.

Clients never see these internals—only the MP4 stream.

---

### 10  Provider-Node Endpoint (reference)

\`\`\`
POST http://<node-host>:<port>/video
\`\`\`

Same JSON as the public endpoint; returns an MP4 stream. No auth needed because only the orchestrator calls it.

---

### 11  Changelog

| Date (UTC) | Change |
|------------|--------|
| 2025-04-26 | Initial specification written. |

---

**Next:** tell me which route you’d like documented next (images, completions, health, billing, …); or ask for a full compiled OpenAPI/Swagger file, markdown site, or PDF.
`,
  },
  {
    route: "/api/v1/image",
    docs: `
## Endpoint \`POST /api/v1/image\`

Create a **PNG image** from a text prompt via the decentralized diffusion-model network.
The Next .js router selects a healthy Stable Diffusion node, forwards the request, rewards the node, and streams the PNG back.

---

### 1 URL
\`\`\`
POST https://<orchestrator-host>/api/v1/image
\`\`\`

---

### 2 Pre-flight (CORS)
\`\`\`
OPTIONS /api/v1/image
\`\`\`

| Header | Value |
|--------|-------|
| Access-Control-Allow-Origin | \`*\` |
| Access-Control-Allow-Headers | \`Content-Type, Authorization, X-User-Id, X-Title, HTTP-Referer\` |
| Access-Control-Allow-Methods | \`POST, OPTIONS\` |

---

### 3 Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| **Authorization** | ✓ | \`Bearer <API_KEY>\` |
| **X-User-Id** | ✓ | Internal user/customer id for metering. |
| **X-Title** | — | Friendly service / product name (per-service analytics). |
| **HTTP-Referer** | — | Originating page URL (analytics). |
| **Content-Type** | ✓ | \`application/json\` |

---

### 4 Request Body

\`\`\`jsonc
{
  "prompt":             "an astronaut riding a horse",   // required
  "negativePrompt":     "low-res, blurry",               // optional
  "numInferenceSteps":  30,                              // optional (default 30)
  "width":              512,                             // optional (default 512)
  "height":             512,                             // optional (default 512)

  // …any diffusers / Stable Diffusion runtime options
}
\`\`\`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| \`prompt\` | \`string\` | ✓ | The positive text-to-image prompt. |
| \`negativePrompt\` | \`string\` | — | Content to steer *away* from. |
| \`numInferenceSteps\` | \`integer\` | — | Diffusion steps (quality vs. speed). |
| \`width\`,\`height\` | \`integer\` | — | Output resolution in pixels (powers of 8). |
| _…any other key_ | \`any\` | — | Passed straight to Diffusers pipeline. |

---

### 5 Successful Response \`200 OK\`

*Binary stream* – a PNG file.

| Header | Value |
|--------|-------|
| \`Content-Type\` | \`image/png\` |
| \`Access-Control-Allow-Origin\` | \`*\` |

> The body is a **streaming PNG**; save it as a file or pipe it onward.

---

### 6 Error Responses

| HTTP status | JSON body | Cause |
|-------------|-----------|-------|
| **400** | \`{ "error": "Missing \\'prompt\\' field." }\` | \`prompt\` absent. |
| **401** | \`{ "error": "Invalid API key" }\` | Bad/absent \`Authorization\`. |
| **503** | \`{ "error": "No healthy image provision found" }\` | All image nodes failed health-check. |
| **500** | \`{ "error": "Internal server error" }\` | Unhandled exception in router. |
| **502-504** | \`{ "error": "Node error: …" }\` | Provider returned non-200; message forwarded. |

---

### 7 Example cURL

\`\`\`bash
curl https://api.my-net.io/api/v1/image \\
  -H "Authorization: Bearer sk-live-abc123" \\
  -H "X-User-Id: user_42" \\
  -H "Content-Type: application/json" \\
  --output astronaut_horse.png \\
  -d '{
        "prompt": "an astronaut riding a horse",
        "negativePrompt": "low-res, blurry",
        "numInferenceSteps": 40,
        "width": 640,
        "height": 640
      }'
\`\`\`

---

### 8 OpenAPI Snippet

\`\`\`yaml
paths:
  /api/v1/image:
    post:
      summary: Generate a PNG image from a text prompt
      operationId: createImage
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ImageRequest'
      responses:
        '200':
          description: PNG stream
          content:
            image/png: {}
        '400': { $ref: '#/components/responses/BadRequest' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '503': { $ref: '#/components/responses/ServiceUnavailable' }
        '500': { $ref: '#/components/responses/InternalError' }

components:
  schemas:
    ImageRequest:
      type: object
      required: [prompt]
      properties:
        prompt: { type: string }
        negativePrompt: { type: string }
        numInferenceSteps: { type: integer, minimum: 1 }
        width:  { type: integer, minimum: 64 }
        height: { type: integer, minimum: 64 }
      additionalProperties: true
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
\`\`\`

---

### 9 Internal Flow (router → node)

1. **API-key check** \`validateApiKey\`.
2. **Node selection** \`selectImageProvision("stable-diffusion-2-1-base")\` + three health probes.
3. **Forward** JSON to \`http://<node>/image\`.
4. **Provider** runs Diffusers-JS Stable Diffusion pipeline → PNG.
5. **Stream** PNG back through the router with CORS headers.
6. **Metrics** \`updateImageMetadata(latency)\` and, if \`X-Title\` present, \`updateImageServiceMetadata\`.
7. **Reward** node owner \`rewardProvider(providerId, 0.01)\`.

Clients are unaware of these internals.

---

### 10 Provider-Node Endpoint (reference)

\`\`\`
POST http://<node-host>:<port>/image
\`\`\`
JSON body identical to public endpoint; returns a PNG stream. No auth—calls originate only from the orchestrator.

---

### 11 Changelog

| Date (UTC) | Change |
|------------|--------|
| 2025-04-26 | Initial specification drafted. |

---

**Next:** tell me which route to document next (e.g. \`/api/v1/audio\`, \`/credits/charge\`, health probes) or if you need a consolidated OpenAPI file / HTML docs.
`,
  },
  {
    route: "/api/v1/m/caption",
    docs: ``,
  },
  {
    route: "/api/v1/m/detect",
    docs: ``,
  },
  {
    route: "/api/v1/m/point",
    docs: ``,
  },
  {
    route: "/api/v1/m/query",
    docs: ``,
  },
  {
    route: "/api/v1/tts",
    docs: `
## Vision-Language (“Moon”) API group

These endpoints let you run image-understanding tasks—captioning, object detection, object centroids, and visual Q & A—through your decentralized **Moon** nodes.

All four routes share the same transport, auth, and CORS behaviour; the only differences are the request body and the JSON they return.

---

### 0 Common contract

| Item | Value |
|------|-------|
| **Base URL** | \`https://<orchestrator-host>/api/v1/m\` |
| **Auth header** | \`Authorization: Bearer <API_KEY>\` |
| **Mandatory header** | \`X-User-Id\` – internal customer id |
| **Optional headers** | \`X-Title\`, \`HTTP-Referer\` |
| **Content-Type** | \`application/json\` |
| **Pre-flight** | \`OPTIONS /api/v1/m/*\` returns:<br>\`Access-Control-Allow-Origin: *\`<br>\`Access-Control-Allow-Methods: POST, OPTIONS\` |

Error codes are consistent with earlier routes (\`400\`, \`401\`, \`503\`, \`500\`, plus propagated node errors).

---

## 1 \`POST /api/v1/m/caption\`

### Purpose
Generate a **natural-language caption** for an input image.

### Request body
\`\`\`jsonc
{
  // Image (choose one)
  "imageUrl":     "https://example.com/pic.jpg"  // remote or data URI
  "imageBase64":  "<base64-string>",
  "imageUint8":   [255, 216, 255, 224, …],

  // Options
  "length": "short" | "normal" | "long"   // default: "normal"
}
\`\`\`

### Success \`200 OK\`
\`\`\`json
{ "caption": "A golden retriever catching a frisbee in mid-air." }
\`\`\`

---

## 2 \`POST /api/v1/m/detect\`

### Purpose
Detect **all bounding boxes** of a given object class.

### Request body
\`\`\`jsonc
{
  // Image  (one of …)
  "imageUrl": "...",
  "imageBase64": "...",
  "imageUint8": [...],

  // Required
  "target": "car"            // object label
}
\`\`\`

### Success \`200 OK\`
\`\`\`json
{
  "objects": [
    { "label": "car",
      "box":   [x1, y1, x2, y2],   // pixel coords
      "confidence": 0.92 }
  ]
}
\`\`\`

---

## 3 \`POST /api/v1/m/point\`

### Purpose
Return **centroid point(s)** for all instances of a target object.

### Request body
\`\`\`jsonc
{
  "imageUrl": "...",
  "imageBase64": "...",
  "imageUint8": [...],
  "target": "person"
}
\`\`\`

### Success \`200 OK\`
\`\`\`json
{
  "points": [
    { "x": 312, "y": 154 },
    { "x": 488, "y": 160 }
  ]
}
\`\`\`

---

## 4 \`POST /api/v1/m/query\`

### Purpose
Ask a **free-form question** about an image (visual question answering).

### Request body
\`\`\`jsonc
{
  "imageUrl": "...",
  "imageBase64": "...",
  "imageUint8": [...],
  "question": "How many bicycles are there?"
}
\`\`\`

### Success \`200 OK\`
\`\`\`json
{ "answer": "There are three bicycles." }
\`\`\`

---

### Example cURL (caption)

\`\`\`bash
curl https://api.my-net.io/api/v1/m/caption \\
  -H "Authorization: Bearer sk-live-abc123" \\
  -H "X-User-Id: user_42" \\
  -H "Content-Type: application/json" \\
  -d '{
        "imageUrl":"https://images.example.com/dog.jpg",
        "length":"short"
      }'
\`\`\`

---

### OpenAPI snippet (shared components abbreviated)

\`\`\`yaml
components:
  schemas:
    ImageInput:
      oneOf:
        - type: object
          required: [imageUrl]
          properties: { imageUrl: { type: string, format: uri } }
        - type: object
          required: [imageBase64]
          properties: { imageBase64: { type: string } }
        - type: object
          required: [imageUint8]
          properties:
            imageUint8:
              type: array
              items: { type: integer, minimum: 0, maximum: 255 }
    CaptionRequest:
      allOf:
        - $ref: '#/components/schemas/ImageInput'
        - type: object
          properties:
            length: { type: string, enum: [short, normal, long] }
    CaptionResponse:
      type: object
      properties: { caption: { type: string } }
    DetectRequest:
      allOf:
        - $ref: '#/components/schemas/ImageInput'
        - type: object
          required: [target]
          properties: { target: { type: string } }
    DetectResponse:
      type: object
      properties:
        objects:
          type: array
          items:
            type: object
            properties:
              label: { type: string }
              box:   { type: array, items: { type: number }, minItems: 4, maxItems: 4 }
              confidence: { type: number }
    PointRequest:  { allOf: [ { $ref: '#/components/schemas/DetectRequest' } ] }
    PointResponse:
      type: object
      properties:
        points:
          type: array
          items: { type: object, properties: { x: {type:number}, y:{type:number} } }
    QueryRequest:
      allOf:
        - $ref: '#/components/schemas/ImageInput'
        - type: object
          required: [question]
          properties: { question: { type: string } }
    QueryResponse:
      type: object
      properties: { answer: { type: string } }
\`\`\`

*(Add four \`paths:\` entries referencing these schemas.)*

---

### Internal flow (all four routes)

1. **Key check** \`validateApiKey\`.
2. **Node selection** \`selectMoonProvision()\` → health-probe (3 tries; bad nodes removed).
3. **Forward** request to \`http://<node>/m/{caption\\|detect\\|point\\|query}\`.
4. **Measure** latency; \`updateMoonMetadata(<endpoint>, latency)\`.
5. **Per-service metrics** if \`X-Title\` present.
6. **Reward** node owner \`rewardProvider(providerId, 0.01)\`.
7. **Return** JSON with CORS headers.

---

### Changelog

| Date (UTC) | Change |
|------------|--------|
| 2025-04-26 | Initial specification for caption, detect, point, query. |

---

**Next:** let me know if you want documentation for any remaining endpoints, a merged OpenAPI file, or HTML/PDF output.
`,
  },
  {
    route: "/api/v1/scrape",
    docs: `
## Endpoint \`POST /api/v1/tts\`

Generate **spoken audio (WAV)** from text using the Kokoro TTS model.
This endpoint is typically handled directly by the orchestrator or a dedicated TTS service, unlike the decentralized model endpoints.

---

### 1  URL

\`\`\`
POST https://<your-orchestrator-host>/api/v1/tts
\`\`\`

---

### 2  Pre-flight (CORS)

\`\`\`
OPTIONS /api/v1/tts
\`\`\`

| Header | Value |
|--------|-------|
| Access-Control-Allow-Origin | \`*\` |
| Access-Control-Allow-Headers | \`Content-Type, Authorization, X-User-Id, X-Title, HTTP-Referer\` |
| Access-Control-Allow-Methods | \`POST, OPTIONS\` |

*(Assumes standard CORS setup consistent with other endpoints)*

---

### 3  Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| **Authorization** | ✓ | \`Bearer <API_KEY>\` (Assumed standard auth) |
| **X-User-Id** | ✓ | Internal user/customer id for metering (Assumed standard header) |
| **X-Title** | — | Friendly service / product name (Assumed standard header) |
| **HTTP-Referer** | — | Originating page URL (Assumed standard header) |
| **Content-Type** | ✓ | \`application/json\` |

---

### 4  Request Body

\`\`\`jsonc
{
  "text":   "string",    // required – Text to synthesize
  "voice":  "string"     // optional – Voice ID (e.g., "af_bella", "bm_george")
}
\`\`\`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| \`text\` | \`string\` | ✓ | The text content to be converted into speech. |
| \`voice\` | \`string\` | — | Optional voice identifier. Defaults to \`"af_bella"\`. Available voices include: \`af\`, \`af_bella\`, \`af_nicole\`, \`af_sarah\`, \`af_sky\`, \`am_adam\`, \`am_michael\`, \`bf_emma\`, \`bf_isabella\`, \`bm_george\`, \`bm_lewis\`, etc. (Refer to Kokoro documentation for full list). |

---

### 5  Successful Response \`200 OK\`

*Binary stream* – a WAV audio file.

| Header | Value |
|--------|-------|
| \`Content-Type\` | \`audio/wav\` |
| \`Access-Control-Allow-Origin\` | \`*\` |

> The body is **streaming WAV audio data**. Consume it directly as an audio file.

---

### 6  Error Responses

| HTTP status | JSON body | Cause |
|-------------|-----------|-------|
| **400** | \`{ "error": "Text is required for TTS." }\` | \`text\` field missing in request body. |
| **401** | \`{ "error": "Invalid API key" }\` | Bad/absent \`Authorization\` (Assumed standard error). |
| **500** | \`{ "error": "<error message from TTS engine>" }\` | Internal server error during TTS processing (e.g., model not loaded, synthesis failed). |
| **503** | \`{ "error": "TTS service unavailable" }\` | Service potentially not ready or overloaded (if applicable). |

---

### 7  Example cURL

\`\`\`bash
curl https://api.my-net.io/api/v1/tts \\
  -H "Authorization: Bearer sk-live-abc123" \\
  -H "X-User-Id: user_42" \\
  -H "Content-Type: application/json" \\
  --output hello_world.wav \\
  -d '{
        "text": "Hello world, this is a test.",
        "voice": "bm_lewis"
      }'
\`\`\`

---

### 8  OpenAPI Snippet

\`\`\`yaml
paths:
  /api/v1/tts:
    post:
      summary: Generate speech (WAV) from text
      operationId: createTts
      security:
        - bearerAuth: [] # Assumed standard security
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TtsRequest'
      responses:
        '200':
          description: WAV audio stream
          content:
            audio/wav:
              schema:
                type: string
                format: binary
        '400':
           description: Bad Request (e.g., missing text)
           content:
             application/json:
               schema:
                 type: object
                 properties:
                   error: { type: string }
        '401': { $ref: '#/components/responses/Unauthorized' } # Assumed standard
        '500': { $ref: '#/components/responses/InternalError' } # Assumed standard
        '503': { $ref: '#/components/responses/ServiceUnavailable' } # Assumed standard

components:
  schemas:
    TtsRequest:
      type: object
      required: [text]
      properties:
        text:
          type: string
          description: The text to synthesize into speech.
        voice:
          type: string
          description: Optional voice ID. Defaults to 'af_bella'.
          default: 'af_bella'
          example: 'bm_george'
  # Assumed standard responses/securitySchemes defined elsewhere
  responses:
    Unauthorized:
      description: Authentication information is missing or invalid.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
    InternalError:
      description: Unexpected server error.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
    ServiceUnavailable:
      description: Service is temporarily unavailable.
      content:
        application/json:
          schema: { $ref: '#/components/schemas/ErrorResponse' }
    ErrorResponse:
      type: object
      properties:
        error: { type: string }
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
\`\`\`

---

### 9  Internal Flow (Orchestrator/Service)

1. **Load Model:** (Done once at startup) The Kokoro TTS model (\`onnx-community/Kokoro-82M-ONNX\`) is loaded into memory using \`KokoroTTS.from_pretrained()\`.
2. **Receive Request:** The Express router receives the POST request.
3. **Validate Input:** Checks for the presence of the required \`text\` field.
4. **Synthesize Audio:** Calls \`tts.generate(text, { voice })\` using the pre-loaded model instance.
5. **Format Output:** The returned \`Audio\` object is converted to WAV format using \`.toWav()\`.
6. **Stream Response:** The WAV audio data (as a Buffer) is sent back to the client with the \`Content-Type: audio/wav\` header.
7. **Error Handling:** Catches errors during synthesis or request processing and returns appropriate JSON error responses.

*(Note: This flow differs from the decentralized endpoints as it likely runs within the main orchestrator or a dedicated service, without node selection or reward mechanisms.)*

---

### 10 Changelog

| Date (UTC) | Change |
|------------|--------|
| 2025-04-27 | Initial specification based on Express router code. |

---
`
  },
  {
    route: "/api/v1/chat/completions",
    docs: `
## Endpoint \`POST /api/v1/chat/completions\`
(OpenAI-compatible chat completions)

The route mirrors the OpenAI \`/v1/chat/completions\` contract so you can point an *unchanged* OpenAI SDK or cURL script at **\`https://<orchestrator-host>/api/v1\`**.
Internally the request is forwarded to an Ollama-compatible node, parameters are translated, usage is metered, and a micro-payment is sent to the provider.

---

### 1 URL and CORS

\`\`\`
POST https://<orchestrator-host>/api/v1/chat/completions
\`\`\`

\`OPTIONS /api/v1/chat/completions\` responds with

\`\`\`
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Id, X-Title, HTTP-Referer
Access-Control-Allow-Methods: POST, OPTIONS
\`\`\`

---

### 2 Request Headers

| Header \\| Required \\| Notes |
|--------\\|----------\\|-------|
| **Authorization** \\| ✓ \\| \`Bearer <API_KEY>\` issued by your network |
| **X-User-Id** \\| ✓ \\| Internal customer / tenant id |
| **X-Title** \\| — \\| Friendly service name for per-service stats |
| **HTTP-Referer** \\| — \\| Calling-site URL (analytics) |
| **Content-Type** \\| ✓ \\| \`application/json\` |

---

### 3 Request Body (high-level)

All standard OpenAI fields are accepted (\`model\`, \`messages\`, \`functions\` → translated to Ollama \`tools\`, \`response_format\`, \`stream\`, **plus any** generative parameters such as \`temperature\`, \`top_p\`, \`max_tokens\`, etc.).

\`\`\`jsonc
{
  "model":    "gpt-4o",             // required – any model id present in the network
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user",   "content": "Hello!" }
  ],

  // Optional OpenAI parameters ----------------------------
  "stream": true,
  "temperature": 0.7,
  "functions": [
    {
      "name": "get_weather",
      "description": "Get the weather for a city",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  ],
  "response_format": { "type": "json_object" }
}
\`\`\`

---

### 4 Successful Response

*Non-streaming* — identical to OpenAI’s **chat completion object**:

\`\`\`json
{
  "id": "chatcmpl-qY…",
  "object": "chat.completion",
  "created": 1714143432,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello! How can I help you today?" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 14, "completion_tokens": 9, "total_tokens": 23 }
}
\`\`\`

*Streaming* — Server-Sent Events exactly like OpenAI (\`data: { "id": … }\` chunks ending with \`data: [DONE]\`).

---

### 5 Error Codes

| Code \\| Meaning |
|------\\|---------|
| **400** \\| Missing \`model\` or \`messages\` |
| **401** \\| Invalid / missing API key |
| **503** \\| No healthy provision for requested model |
| **500** \\| Internal error (or propagated provider error with status > 500) |

---

### 6 cURL Examples

**Basic (non-streaming)**

\`\`\`bash
curl https://api.my-net.io/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-live-abc123" \\
  -H "X-User-Id: user_42" \\
  -d '{
        "model": "gpt-4o",
        "messages": [
          { "role": "system", "content": "You are a helpful assistant." },
          { "role": "user",   "content": "Hello!" }
        ],
        "temperature": 0.7
      }'
\`\`\`

**Streaming**

\`\`\`bash
curl -N https://api.my-net.io/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-live-abc123" \\
  -H "X-User-Id: user_42" \\
  -d '{
        "model":"gpt-4o",
        "stream":true,
        "messages":[
          { "role":"system","content":"You are a helpful assistant." },
          { "role":"user","content":"Tell me a joke." }
        ]
      }'
\`\`\`

---

### 7 OpenAI SDK Examples (fully compatible)

> **Tip :** OpenAI’s SDKs require a key even if your backend doesn’t check it; pass any non-empty string.

#### Node ( \`openai\` ≥ 4 )

\`\`\`ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "sk-live-abc123",
  baseURL: "https://api.my-net.io/api/v1",
  defaultHeaders: {           // optional analytics
    "X-User-Id": "user_42",
    "X-Title":  "my-awesome-app"
  },
});

const chat = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user",   content: "How do I center a div in CSS?" }
  ],
  temperature: 0.5,
});

console.log(chat.choices[0].message.content);
\`\`\`

#### Python ( \`openai\` ≥ 1.12 )

\`\`\`py
from openai import OpenAI

client = OpenAI(
    api_key="sk-live-abc123",
    base_url="https://api.my-net.io/api/v1",
    default_headers={
        "X-User-Id": "user_42",
        "X-Title": "my-awesome-app"
    }
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user",   "content": "Explain quantum entanglement in 2 sentences."}
    ],
    stream=False          # or True for SSE streaming
)

print(response.choices[0].message.content)
\`\`\`

Both snippets:

* use **valid OpenAI roles** (\`system\`, \`user\`, \`assistant\`, \`tool\`);
* reference a **current model id** (\`gpt-4o\`);
  replace with any model name registered in your network;
* set \`baseURL\`/\`base_url\` so the SDK talks to **your** router, not api.openai.com.

---

### 8 Internal Flow (summary)

1. **Auth + quota** → \`validateApiKey\`.
2. **Provision selection** → \`selectProvision(model)\` → health probes (3 tries).
3. **Request transform**:
   * \`response_format\` → \`format\` (Ollama)
   * \`functions\` → \`tools\`.
4. **Forward** to \`http://<node>/chat/completions\` (stream or JSON).
5. **Metrics & rewards** → \`updateMetadata\`, \`updateServiceMetadata\`, \`rewardProvider\`.
6. **Return** SSE stream or JSON, unmodified from provider (OpenAI shape).

---

### 9 Changelog

| Date (UTC) \\| Change |
|------------\\|--------|
| 2025-04-26 \\| Initial OpenAI-compatible specification added |

---

Need a consolidated OpenAPI file or more examples (function calling, tool choice, Vision messages)? Just let me know!
`,
  },
];
