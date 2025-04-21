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

  
// Define the interface based on the user's request
export interface Models {
  Name: string;
  InputModalities: string[];
  OutputModalities: string[];
  Category: string;
  description: string;
  Creator: string;
  creatorUrl: string;
  blogUrl?: string; // Optional as some entries might not have it
  contextSize?: string; // Optional
  outputLength?: string; // Optional, used for token count or vector dimension string
  vectorSize?: number; // Optional, specifically for embedding vector dimensions
}

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
export const models: Models[] = [
  {
    Name: "nomic-embed-text",
    Category: "embeddings",
    description: "nomic-embed-text is a large context length text encoder that surpasses OpenAI text-embedding-ada-002 and text-embedding-3-small performance on short and long context tasks.",
    Creator: "Nomic AI",
    creatorUrl: "https://www.nomic.ai/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "8192",
    outputLength: "vector dimensions: 768, 512, 256, 128, 64",
    blogUrl: "https://www.nomic.ai/blog/posts/nomic-embed-text-v1",
    vectorSize: parseVectorSize("embeddings", "vector dimensions: 768, 512, 256, 128, 64") // Parses 768
  },
  {
    Name: "mxbai-embed-large",
    Category: "embeddings",
    description: "As of March 2024, this model archives SOTA performance for Bert-large sized models on the MTEB. It outperforms commercial models like OpenAIs text-embedding-3-large model and matches the performance of model 20x its size. mxbai-embed-large was trained with no overlap of the MTEB data, which indicates that the model generalizes well across several domains, tasks and text length.",
    Creator: "Mixedbread AI",
    creatorUrl: "https://www.mixedbread.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "512",
    outputLength: "up to 1024",
    blogUrl: "https://www.mixedbread.com/blog/mxbai-embed-large-v1",
    vectorSize: parseVectorSize("embeddings", "up to 1024") // Parses 1024
  },
  {
    Name: "bge-m3",
    Category: "embeddings",
    description: `"BGE-M3 is based on the XLM-RoBERTa architecture and is distinguished for its versatility in Multi-Functionality, Multi-Linguality, and Multi-Granularity:\n\nMulti-Functionality: It can simultaneously perform the three common retrieval functionalities of embedding model: dense retrieval, multi-vector retrieval, and sparse retrieval.\nMulti-Linguality: It can support more than 100 working languages.\nMulti-Granularity: It is able to process inputs of different granularities, spanning from short sentences to long documents of up to 8192 tokens."`,
    Creator: "BAAI",
    creatorUrl: "https://www.baai.ac.cn/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "8192",
    outputLength: "1024",
    blogUrl: "https://arxiv.org/pdf/2402.03216",
    vectorSize: parseVectorSize("embeddings", "1024") // Parses 1024
  },
  {
    Name: "snowflake-arctic-embed:22m",
    Category: "embeddings",
    description: `"snowflake-arctic-embed is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.\n\nThe models are trained by leveraging existing open-source text representation models, such as bert-base-uncased, and are trained in a multi-stage pipeline to optimize their retrieval performance.\n\nThis model is available in 5 parameter sizes:\n\nsnowflake-arctic-embed:335m (default)\nsnowflake-arctic-embed:137m\nsnowflake-arctic-embed:110m\nsnowflake-arctic-embed:33m\nsnowflake-arctic-embed:22m"`,
    Creator: "Snowflake",
    creatorUrl: "https://www.snowflake.com/en/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "512",
    outputLength: "384",
    blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
    vectorSize: parseVectorSize("embeddings", "384") // Parses 384
  },
  {
    Name: "snowflake-arctic-embed:33m",
    Category: "embeddings",
    description: `"snowflake-arctic-embed is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.\n\nThe models are trained by leveraging existing open-source text representation models, such as bert-base-uncased, and are trained in a multi-stage pipeline to optimize their retrieval performance.\n\nThis model is available in 5 parameter sizes:\n\nsnowflake-arctic-embed:335m (default)\nsnowflake-arctic-embed:137m\nsnowflake-arctic-embed:110m\nsnowflake-arctic-embed:33m\nsnowflake-arctic-embed:22m"`,
    Creator: "Snowflake",
    creatorUrl: "https://www.snowflake.com/en/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "512",
    outputLength: "384",
    blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
    vectorSize: parseVectorSize("embeddings", "384") // Parses 384
  },
  {
    Name: "snowflake-arctic-embed:110m",
    Category: "embeddings",
    description: `"snowflake-arctic-embed is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.\n\nThe models are trained by leveraging existing open-source text representation models, such as bert-base-uncased, and are trained in a multi-stage pipeline to optimize their retrieval performance.\n\nThis model is available in 5 parameter sizes:\n\nsnowflake-arctic-embed:335m (default)\nsnowflake-arctic-embed:137m\nsnowflake-arctic-embed:110m\nsnowflake-arctic-embed:33m\nsnowflake-arctic-embed:22m"`,
    Creator: "Snowflake",
    creatorUrl: "https://www.snowflake.com/en/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "512",
    outputLength: "768",
    blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
    vectorSize: parseVectorSize("embeddings", "768") // Parses 768
  },
  {
    Name: "snowflake-arctic-embed:137m",
    Category: "embeddings",
    description: `"snowflake-arctic-embed is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.\n\nThe models are trained by leveraging existing open-source text representation models, such as bert-base-uncased, and are trained in a multi-stage pipeline to optimize their retrieval performance.\n\nThis model is available in 5 parameter sizes:\n\nsnowflake-arctic-embed:335m (default)\nsnowflake-arctic-embed:137m\nsnowflake-arctic-embed:110m\nsnowflake-arctic-embed:33m\nsnowflake-arctic-embed:22m"`,
    Creator: "Snowflake",
    creatorUrl: "https://www.snowflake.com/en/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "8192",
    outputLength: "768",
    blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
    vectorSize: parseVectorSize("embeddings", "768") // Parses 768
  },
  {
    Name: "snowflake-arctic-embed:335m",
    Category: "embeddings",
    description: `"snowflake-arctic-embed is a suite of text embedding models that focuses on creating high-quality retrieval models optimized for performance.\n\nThe models are trained by leveraging existing open-source text representation models, such as bert-base-uncased, and are trained in a multi-stage pipeline to optimize their retrieval performance.\n\nThis model is available in 5 parameter sizes:\n\nsnowflake-arctic-embed:335m (default)\nsnowflake-arctic-embed:137m\nsnowflake-arctic-embed:110m\nsnowflake-arctic-embed:33m\nsnowflake-arctic-embed:22m"`,
    Creator: "Snowflake",
    creatorUrl: "https://www.snowflake.com/en/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("vector"),
    contextSize: "512",
    outputLength: "1024",
    blogUrl: "https://www.snowflake.com/en/blog/introducing-snowflake-arctic-embed-snowflakes-state-of-the-art-text-embedding-family-of-models/",
    vectorSize: parseVectorSize("embeddings", "1024") // Parses 1024
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
    vectorSize: parseVectorSize("embeddings", "384") // Parses 384
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
    vectorSize: parseVectorSize("embeddings", "384") // Parses 384
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
    vectorSize: parseVectorSize("embeddings", "1024") // Parses 1024
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
    vectorSize: undefined // Not an embedding model
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
    vectorSize: undefined // Not an embedding model
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
    vectorSize: undefined // Not an embedding model
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
    vectorSize: undefined // Not an embedding model
  },
  {
    Name: "llama3.2-vision:11b",
    Category: "vision",
    description: `"The Llama 3.2-Vision collection of multimodal large language models (LLMs) is a collection of instruction-tuned image reasoning generative models in 11B and 90B sizes (text + images in / text out). The Llama 3.2-Vision instruction-tuned models are optimized for visual recognition, image reasoning, captioning, and answering general questions about an image. The models outperform many of the available open source and closed multimodal models on common industry benchmarks.\n\nSupported Languages: For text only tasks, English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai are officially supported. Llama 3.2 has been trained on a broader collection of languages than these 8 supported languages. Note for image+text applications, English is the only language supported."`,
    Creator: "Meta",
    creatorUrl: "https://huggingface.co/meta-llama",
    InputModalities: parseModalities("text, image"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "4096",
    blogUrl: "https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/",
    vectorSize: undefined // Not an embedding model
  },
  {
    Name: "minicpm-v",
    Category: "vision",
    description: `"MiniCPM-V 2.6 is the latest and most capable model in the MiniCPM-V series. The model is built on SigLip-400M and Qwen2-7B with a total of 8B parameters. It exhibits a significant performance improvement over MiniCPM-Llama3-V 2.5, and introduces new features for multi-image and video understanding. Notable features of MiniCPM-V 2.6 include:\n\n🔥 Leading Performance: MiniCPM-V 2.6 achieves an average score of 65.2 on the latest version of OpenCompass, a comprehensive evaluation over 8 popular benchmarks. With only 8B parameters, it surpasses widely used proprietary models like GPT-4o mini, GPT-4V, Gemini 1.5 Pro, and Claude 3.5 Sonnet for single image understanding.\n\n🖼️ Multi Image Understanding and In-context Learning. MiniCPM-V 2.6 can also perform conversation and reasoning over multiple images. It achieves state-of-the-art performance on popular multi-image benchmarks such as Mantis-Eval, BLINK, Mathverse mv and Sciverse mv, and also shows promising in-context learning capability.\n\n💪 Strong OCR Capability: MiniCPM-V 2.6 can process images with any aspect ratio and up to 1.8 million pixels (e.g., 1344x1344). It achieves state-of-the-art performance on OCRBench, surpassing proprietary models such as GPT-4o, GPT-4V, and Gemini 1.5 Pro. Based on the the latest RLAIF-V and VisCPM techniques, it features trustworthy behaviors, with significantly lower hallucination rates than GPT-4o and GPT-4V on Object HalBench, and supports multilingual capabilities on English, Chinese, German, French, Italian, Korean, etc.\n\n🚀 Superior Efficiency: In addition to its friendly size, MiniCPM-V 2.6 also shows state-of-the-art token density (i.e., number of pixels encoded into each visual token). It produces only 640 tokens when processing a 1.8M pixel image, which is 75% fewer than most models. This directly improves the inference speed, first-token latency, memory usage, and power consumption."`,
    Creator: "openBMB",
    creatorUrl: "https://huggingface.co/openbmb",
    InputModalities: parseModalities("text, image"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "8192",
    blogUrl: "https://github.com/OpenBMB/MiniCPM-o",
    vectorSize: undefined // Not an embedding model
  },
  {
    Name: "llava-llama3",
    Category: "vision",
    description: "llava-llama-3-8b-v1_1 is a LLaVA model fine-tuned from meta-llama/Meta-Llama-3-8B-Instruct and CLIP-ViT-Large-patch14-336 with ShareGPT4V-PT and InternVL-SFT by XTuner.",
    Creator: "xtuner",
    creatorUrl: "https://huggingface.co/xtuner",
    InputModalities: parseModalities("text, image"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k", // Assuming this is the same as minicpm-v based on structure, might need clarification
    outputLength: "4096",
    blogUrl: undefined, // No specific blog post listed, only HF link
    vectorSize: undefined // Not an embedding model
  },
  {
    Name: "moondream",
    Category: "vision",
    description: `"Moondream is an open-source visual language model that understands images using simple text prompts. It's fast, wildly capable — and just 1GB in size.\n\nVision AI at Warp Speed\nForget everything you thought you needed to know about computer vision. With Moondream, there's no training, no ground truth data, and no heavy infrastructure. Just a model, a prompt, and a whole world of visual understanding.\n\nRidiculously lightweight\nUnder 2B parameters. Quantized to 4-bit. Just 1GB. Moondream runs anywhere — from edge devices to your laptop.\n\nActually affordable\nRun it locally for free. Or use our cloud API to process a high volume of images quickly and cheaply. Free tier included.\n\nSimple by design\nChoose a capability. Write a prompt. Get results. That's it. Moondream is designed for developers who don't want to babysit models.\n\nVersatile as hell\nGo beyond basic visual Q&A. Moondream can caption, detect objects, locate things, read documents, follow gaze, and more.\n\nTried, tested, trusted\n6M+ downloads. 8K+ GitHub stars. Used across industries — from healthcare to robotics to mobile apps."`,
    Creator: "moondream",
    creatorUrl: "https://moondream.ai/",
    InputModalities: parseModalities("text, image"),
    OutputModalities: parseModalities("text"),
    contextSize: undefined, // Not specified in data
    outputLength: undefined, // Not specified in data
    blogUrl: "https://moondream.ai/blog/introducing-a-new-moondream-1-9b-and-gpu-support",
    vectorSize: undefined // Not an embedding model
  },
  {
    Name: "granite3.2-vision",
    Category: "vision",
    description: "Model Summary: granite-vision-3.2-2b is a compact and efficient vision-language model, specifically designed for visual document understanding, enabling automated content extraction from tables, charts, infographics, plots, diagrams, and more. The model was trained on a meticulously curated instruction-following dataset, comprising diverse public datasets and synthetic datasets tailored to support a wide range of document understanding and general image tasks. It was trained by fine-tuning a Granite large language model with both image and text modalities.",
    Creator: "IBM",
    creatorUrl: "https://huggingface.co/ibm-granite",
    InputModalities: parseModalities("text, image"),
    OutputModalities: parseModalities("text"),
    contextSize: undefined, // Not specified in data
    outputLength: undefined, // Not specified in data
    blogUrl: "https://arxiv.org/abs/2502.09927",
    vectorSize: undefined // Not an embedding model
  },
   {
    Name: "mistral-small3.1",
    Category: "vision",
    description: `"Model Card for Mistral-Small-3.1-24B-Instruct-2503\nBuilding upon Mistral Small 3 (2501), Mistral Small 3.1 (2503) adds state-of-the-art vision understanding and enhances long context capabilities up to 128k tokens without compromising text performance. With 24 billion parameters, this model achieves top-tier capabilities in both text and vision tasks.\nThis model is an instruction-finetuned version of: Mistral-Small-3.1-24B-Base-2503.\n\nMistral Small 3.1 can be deployed locally and is exceptionally ""knowledge-dense,"" fitting within a single RTX 4090 or a 32GB RAM MacBook once quantized.\n\nIt is ideal for:\n\nFast-response conversational agents.\nLow-latency function calling.\nSubject matter experts via fine-tuning.\nLocal inference for hobbyists and organizations handling sensitive data.\nProgramming and math reasoning.\nLong document understanding.\nVisual understanding.\nFor enterprises requiring specialized capabilities (increased context, specific modalities, domain-specific knowledge, etc.), we will release commercial models beyond what Mistral AI contributes to the community.\n\nLearn more about Mistral Small 3.1 in our blog post.\n\nKey Features\nVision: Vision capabilities enable the model to analyze images and provide insights based on visual content in addition to text.\nMultilingual: Supports dozens of languages, including English, French, German, Greek, Hindi, Indonesian, Italian, Japanese, Korean, Malay, Nepali, Polish, Portuguese, Romanian, Russian, Serbian, Spanish, Swedish, Turkish, Ukrainian, Vietnamese, Arabic, Bengali, Chinese, Farsi.\nAgent-Centric: Offers best-in-class agentic capabilities with native function calling and JSON outputting.\nAdvanced Reasoning: State-of-the-art conversational and reasoning capabilities.\nApache 2.0 License: Open license allowing usage and modification for both commercial and non-commercial purposes.\nContext Window: A 128k context window.\nSystem Prompt: Maintains strong adherence and support for system prompts.\nTokenizer: Utilizes a Tekken tokenizer with a 131k vocabulary size."`,
    Creator: "Mistral",
    creatorUrl: "https://mistral.ai/",
    InputModalities: parseModalities("text, image"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "128k",
    blogUrl: "https://mistral.ai/news/mistral-small-3-1",
    vectorSize: undefined // Not an embedding model
  },
  {
    Name: "cogito:14b",
    Category: "text",
    description: `"The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.\n\nCogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).\nThe LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.\nThe models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.\nIn both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.\nEach model is trained in over 30 languages and supports a context length of 128k."`,
    Creator: "Cogito",
    creatorUrl: "https://www.deepcogito.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "128k",
    blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
    vectorSize: undefined
  },
  {
    Name: "cogito:32b",
    Category: "text",
    description: `"The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.\n\nCogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).\nThe LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.\nThe models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.\nIn both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.\nEach model is trained in over 30 languages and supports a context length of 128k."`,
    Creator: "Cogito",
    creatorUrl: "https://www.deepcogito.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "128k",
    blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
    vectorSize: undefined
  },
  {
    Name: "cogito:3b",
    Category: "text",
    description: `"The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.\n\nCogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).\nThe LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.\nThe models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.\nIn both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.\nEach model is trained in over 30 languages and supports a context length of 128k."`,
    Creator: "Cogito",
    creatorUrl: "https://www.deepcogito.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "128k",
    blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
    vectorSize: undefined
  },
  {
    Name: "cogito:70b",
    Category: "text",
    description: `"The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.\n\nCogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).\nThe LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.\nThe models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.\nIn both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.\nEach model is trained in over 30 languages and supports a context length of 128k."`,
    Creator: "Cogito",
    creatorUrl: "https://www.deepcogito.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "128k",
    blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
    vectorSize: undefined
  },
  {
    Name: "cogito:8b",
    Category: "text",
    description: `"The Cogito v1 Preview LLMs are instruction tuned generative models (text in/text out). All models are released under an open license for commercial use.\n\nCogito models are hybrid reasoning models. Each model can answer directly (standard LLM), or self-reflect before answering (like reasoning models).\nThe LLMs are trained using Iterated Distillation and Amplification (IDA) - an scalable and efficient alignment strategy for superintelligence using iterative self-improvement.\nThe models have been optimized for coding, STEM, instruction following and general helpfulness, and have significantly higher multilingual, coding and tool calling capabilities than size equivalent counterparts.\nIn both standard and reasoning modes, Cogito v1-preview models outperform their size equivalent counterparts on common industry benchmarks.\nEach model is trained in over 30 languages and supports a context length of 128k."`,
    Creator: "Cogito",
    creatorUrl: "https://www.deepcogito.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "128k",
    blogUrl: "https://www.deepcogito.com/research/cogito-v1-preview",
    vectorSize: undefined
  },
  {
    Name: "deepseek-r1:1.5b",
    Category: "text",
    description: `"DeepSeek R1 Distill Qwen 1.5B is a distilled large language model based on  Qwen 2.5 Math 1.5B, using outputs from DeepSeek R1. It's a very small and efficient model which outperforms GPT 4o 0513 on Math Benchmarks.\n\nOther benchmark results include:\n\nAIME 2024 pass@1: 28.9\nAIME 2024 cons@64: 52.7\nMATH-500 pass@1: 83.9\nThe model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models."`,
    Creator: "Deepseek",
    creatorUrl: "https://www.deepseek.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "33k",
    blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
    vectorSize: undefined
  },
  {
    Name: "deepseek-r1:14b",
    Category: "text",
    description: `"DeepSeek R1 Distill Qwen 14B is a distilled large language model based on Qwen 2.5 14B, using outputs from DeepSeek R1. It outperforms OpenAI's o1-mini across various benchmarks, achieving new state-of-the-art results for dense models.\n\nOther benchmark results include:\n\nAIME 2024 pass@1: 69.7\nMATH-500 pass@1: 93.9\nCodeForces Rating: 1481\nThe model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models."`,
    Creator: "Deepseek",
    creatorUrl: "https://www.deepseek.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "33k",
    blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
    vectorSize: undefined
  },
  {
    Name: "deepseek-r1:32b",
    Category: "text",
    description: `"DeepSeek R1 Distill Qwen 32B is a distilled large language model based on Qwen 2.5 32B, using outputs from DeepSeek R1. It outperforms OpenAI's o1-mini across various benchmarks, achieving new state-of-the-art results for dense models.\n\nOther benchmark results include:\n\nAIME 2024 pass@1: 72.6\nMATH-500 pass@1: 94.3\nCodeForces Rating: 1691\nThe model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models."`,
    Creator: "Deepseek",
    creatorUrl: "https://www.deepseek.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "64k",
    blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
    vectorSize: undefined
  },
  {
    Name: "deepseek-r1:70b",
    Category: "text",
    description: `"DeepSeek R1 Distill Llama 70B is a distilled large language model based on Llama-3.3-70B-Instruct, using outputs from DeepSeek R1. The model combines advanced distillation techniques to achieve high performance across multiple benchmarks, including:\n\nAIME 2024 pass@1: 70.0\nMATH-500 pass@1: 94.5\nCodeForces Rating: 1633\nThe model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models."`,
    Creator: "Deepseek",
    creatorUrl: "https://www.deepseek.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "64k",
    blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
    vectorSize: undefined
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
    vectorSize: undefined
  },
  {
    Name: "deepseek-r1:8b",
    Category: "text",
    description: `"DeepSeek R1 Distill Llama 8B is a distilled large language model based on Llama-3.1-8B-Instruct, using outputs from DeepSeek R1. The model combines advanced distillation techniques to achieve high performance across multiple benchmarks, including:\n\nAIME 2024 pass@1: 50.4\nMATH-500 pass@1: 89.1\nCodeForces Rating: 1205\nThe model leverages fine-tuning from DeepSeek R1's outputs, enabling competitive performance comparable to larger frontier models."`,
    Creator: "Deepseek",
    creatorUrl: "https://www.deepseek.com/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "33k",
    blogUrl: "https://github.com/deepseek-ai/DeepSeek-R1/blob/main/DeepSeek_R1.pdf",
    vectorSize: undefined
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
    vectorSize: undefined
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
    vectorSize: undefined
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
    vectorSize: undefined
  },
  {
    Name: "llama3.3",
    Category: "text",
    description: `"The Meta Llama 3.3 multilingual large language model (LLM) is a pretrained and instruction tuned generative model in 70B (text in/text out). The Llama 3.3 instruction tuned text only model is optimized for multilingual dialogue use cases and outperforms many of the available open source and closed chat models on common industry benchmarks.\n\nSupported languages: English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai."`,
    Creator: "Meta",
    creatorUrl: "https://huggingface.co/meta-llama",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "16k",
    blogUrl: "https://ai.meta.com/blog/future-of-ai-built-with-llama/",
    vectorSize: undefined
  },
  {
    Name: "mistral",
    Category: "text",
    description: `"Mistral is a 7B parameter model, distributed with the Apache license. It is available in both instruct (instruction following) and text completion.\n\nThe Mistral AI team has noted that Mistral 7B:\n\nOutperforms Llama 2 13B on all benchmarks\nOutperforms Llama 1 34B on many benchmarks\nApproaches CodeLlama 7B performance on code, while remaining good at English tasks"`,
    Creator: "Mistral",
    creatorUrl: "https://huggingface.co/mistralai",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "33k", // Updated based on newer Mistral info, spreadsheet had 32k
    outputLength: "8k",
    blogUrl: "https://mistral.ai/news/announcing-mistral-7b",
    vectorSize: undefined
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
    vectorSize: undefined
  },
  {
    Name: "phi4",
    Category: "text",
    description: `"phi-4 is a state-of-the-art open model built upon a blend of synthetic datasets, data from filtered public domain websites, and acquired academic books and Q&A datasets. The goal of this approach was to ensure that small capable models were trained with data focused on high quality and advanced reasoning.\n\nphi-4 underwent a rigorous enhancement and alignment process, incorporating both supervised fine-tuning and direct preference optimization to ensure precise instruction adherence and robust safety measures."`,
    Creator: "Microsoft",
    creatorUrl: "https://huggingface.co/microsoft",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "16k", // Data seems inconsistent, using the lower value mentioned
    outputLength: "8k",
    blogUrl: "https://arxiv.org/pdf/2412.08905",
    vectorSize: undefined
  },
  {
    Name: "phi4-mini",
    Category: "text",
    description: "Phi-4-mini-instruct is a lightweight open model built upon synthetic data and filtered publicly available websites - with a focus on high-quality, reasoning dense data. The model belongs to the Phi-4 model family and supports 128K token context length. The model underwent an enhancement process, incorporating both supervised fine-tuning and direct preference optimization to support precise instruction adherence and robust safety measures",
    Creator: "Microsoft",
    creatorUrl: "https://huggingface.co/microsoft",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "128k",
    blogUrl: "http://techcommunity.microsoft.com/blog/educatordeveloperblog/welcome-to-the-new-phi-4-models---microsoft-phi-4-mini--phi-4-multimodal/4386037",
    vectorSize: undefined
  },
  {
    Name: "qwen2.5:14b",
    Category: "text",
    description: `"Qwen2.5 is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:\n\nIt possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.\nIt demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.\nIt supports long contexts of up to 128K tokens and can generate up to 8K tokens.\nIt offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more."`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
    vectorSize: undefined
  },
  {
    Name: "qwen2.5:32b",
    Category: "text",
    description: `"Qwen2.5 is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:\n\nIt possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.\nIt demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.\nIt supports long contexts of up to 128K tokens and can generate up to 8K tokens.\nIt offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more."`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
    vectorSize: undefined
  },
  {
    Name: "qwen2.5:72b",
    Category: "text",
    description: `"Qwen2.5 is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:\n\nIt possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.\nIt demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.\nIt supports long contexts of up to 128K tokens and can generate up to 8K tokens.\nIt offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more."`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
    vectorSize: undefined
  },
  {
    Name: "qwen2.5:7b",
    Category: "text",
    description: `"Qwen2.5 is the latest series of Qwen large language models. For Qwen2.5, a range of base language models and instruction-tuned models are released, with sizes ranging from 0.5 to 72 billion parameters. Qwen2.5 introduces the following improvements over Qwen2:\n\nIt possesses significantly more knowledge and has greatly enhanced capabilities in coding and mathematics, due to specialized expert models in these domains.\nIt demonstrates significant advancements in instruction following, long-text generation (over 8K tokens), understanding structured data (e.g., tables), and generating structured outputs, especially in JSON format. It is also more resilient to diverse system prompts, improving role-play and condition-setting for chatbots.\nIt supports long contexts of up to 128K tokens and can generate up to 8K tokens.\nIt offers multilingual support for over 29 languages, including Chinese, English, French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean, Vietnamese, Thai, Arabic, and more."`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5/",
    vectorSize: undefined
  },
  {
    Name: "qwq",
    Category: "text",
    description: "QwQ is the reasoning model of the Qwen series. Compared with conventional instruction-tuned models, QwQ, which is capable of thinking and reasoning, can achieve significantly enhanced performance in downstream tasks, especially hard problems. QwQ-32B is the medium-sized reasoning model, which is capable of achieving competitive performance against state-of-the-art reasoning models, e.g., DeepSeek-R1, o1-mini.",
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "131k",
    blogUrl: "https://qwenlm.github.io/blog/qwq-32b/",
    vectorSize: undefined
  },
  {
    Name: "mathstral",
    Category: "math",
    description: `"Mistral AI is contributing Mathstral to the science community to bolster efforts in advanced mathematical problems requiring complex, multi-step logical reasoning. The Mathstral release is part of their broader effort to support academic projects—it was produced in the context of Mistral AI’s collaboration with Project Numina.\n\nAkin to Isaac Newton in his time, Mathstral stands on the shoulders of Mistral 7B and specializes in STEM subjects. It achieves state-of-the-art reasoning capacities in its size category across various industry-standard benchmarks."`,
    Creator: "Mistral",
    creatorUrl: "https://mistral.ai/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "32k",
    outputLength: undefined, // Not specified in data
    blogUrl: "https://mistral.ai/news/mathstral",
    vectorSize: undefined
  },
  {
    Name: "qwen2-math:7b",
    Category: "math",
    description: "Over the past year, we have dedicated significant effort to researching and enhancing the reasoning capabilities of large language models, with a particular focus on their ability to solve arithmetic and mathematical problems. Today, we are delighted to introduce a series of math-specific large language models of our Qwen2 series, Qwen2-Math and Qwen2-Math-Instruct-1.5B/7B/72B. Qwen2-Math is a series of specialized math language models built upon the Qwen2 LLMs, which significantly outperforms the mathematical capabilities of open-source models and even closed-source models (e.g., GPT-4o). We hope that Qwen2-Math can contribute to the community for solving complex mathematical problems.",
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "4k",
    outputLength: "2k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2-math/",
    vectorSize: undefined
  },
  {
    Name: "qwen2-math:72b",
    Category: "math",
    description: "Over the past year, we have dedicated significant effort to researching and enhancing the reasoning capabilities of large language models, with a particular focus on their ability to solve arithmetic and mathematical problems. Today, we are delighted to introduce a series of math-specific large language models of our Qwen2 series, Qwen2-Math and Qwen2-Math-Instruct-1.5B/7B/72B. Qwen2-Math is a series of specialized math language models built upon the Qwen2 LLMs, which significantly outperforms the mathematical capabilities of open-source models and even closed-source models (e.g., GPT-4o). We hope that Qwen2-Math can contribute to the community for solving complex mathematical problems.",
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "4k",
    outputLength: "2k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2-math/",
    vectorSize: undefined
  },
  {
    Name: "deepscaler",
    Category: "math",
    description: `"🚀 Democratizing Reinforcement Learning for LLMs 🌟\n\nDeepScaleR-1.5B-Preview is a language model fine-tuned from DeepSeek-R1-Distilled-Qwen-1.5B using distributed reinforcement learning (RL) to scale up to long context lengths. The model achieves 43.1% Pass@1 accuracy on AIME 2024, representing a 15% improvement over the base model (28.8%) and surpassing OpenAI’s O1-Preview performance with just 1.5B parameters."`,
    Creator: "Agentica",
    creatorUrl: "https://huggingface.co/agentica-org",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "32k",
    outputLength: "8k",
    blogUrl: "https://pretty-radio-b75.notion.site/DeepScaleR-Surpassing-O1-Preview-with-a-1-5B-Model-by-Scaling-RL-19681902c1468005bed8ca303013a4e2",
    vectorSize: undefined
  },
   {
    Name: "qwen2.5-coder:3b",
    Category: "code",
    description: `"Powerful: Qwen2.5-Coder-32B-Instruct has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;\nDiverse: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;\nPractical: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios"`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "32k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
    vectorSize: undefined
  },
  {
    Name: "qwen2.5-coder:7b",
    Category: "code",
    description: `"Powerful: Qwen2.5-Coder-32B-Instruct has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;\nDiverse: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;\nPractical: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios"`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "131k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
    vectorSize: undefined
  },
  {
    Name: "qwen2.5-coder:14b",
    Category: "code",
    description: `"Powerful: Qwen2.5-Coder-32B-Instruct has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;\nDiverse: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;\nPractical: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios"`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
    vectorSize: undefined
  },
  {
    Name: "qwen2.5-coder:32b",
    Category: "code",
    description: `"Powerful: Qwen2.5-Coder-32B-Instruct has become the current SOTA open-source code model, matching the coding capabilities of GPT-4o. While demonstrating strong and comprehensive coding abilities, it also possesses good general and mathematical skills;\nDiverse: Building on the previously open-sourced two sizes of 1.5B / 7B, this release brings four model sizes, including 0.5B / 3B / 14B / 32B. As of now, Qwen2.5-Coder has covered six mainstream model sizes to meet the needs of different developers;\nPractical: We explore the practicality of Qwen2.5-Coder in two scenarios, including code assistants and Artifacts, with some examples showcasing the potential applications of Qwen2.5-Coder in real-world scenarios"`,
    Creator: "Qwen",
    creatorUrl: "https://qwenlm.github.io/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "8k",
    blogUrl: "https://qwenlm.github.io/blog/qwen2.5-coder-family/",
    vectorSize: undefined
  },
  {
    Name: "deepcoder:14b",
    Category: "code",
    description: "DeepCoder-14B-Preview is a code reasoning LLM fine-tuned from DeepSeek-R1-Distilled-Qwen-14B using distributed reinforcement learning (RL) to scale up to long context lengths. The model achieves 60.6% Pass@1 accuracy on LiveCodeBench v5 (8/1/24-2/1/25), representing a 8% improvement over the base model (53%) and achieving similar performance to OpenAI's o3-mini with just 14B parameters.",
    Creator: "Agentica",
    creatorUrl: "https://huggingface.co/agentica-org/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: "8k",
    blogUrl: "https://pretty-radio-b75.notion.site/DeepCoder-A-Fully-Open-Source-14B-Coder-at-O3-mini-Level-1cf81902c14680b3bee5eb349a512a51",
    vectorSize: undefined
  },
  {
    Name: "codegemma:2b",
    Category: "code",
    description: "CodeGemma is a collection of powerful, lightweight models that can perform a variety of coding tasks like fill-in-the-middle code completion, code generation, natural language understanding, mathematical reasoning, and instruction following.",
    Creator: "Google",
    creatorUrl: "https://huggingface.co/google/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "8k",
    outputLength: "4k",
    blogUrl: "https://arxiv.org/abs/2406.11409",
    vectorSize: undefined
  },
  {
    Name: "codegemma:7b",
    Category: "code",
    description: "CodeGemma is a collection of powerful, lightweight models that can perform a variety of coding tasks like fill-in-the-middle code completion, code generation, natural language understanding, mathematical reasoning, and instruction following.",
    Creator: "Google",
    creatorUrl: "https://huggingface.co/google/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "8k",
    outputLength: "4k",
    blogUrl: "https://arxiv.org/abs/2406.11410",
    vectorSize: undefined
  },
  {
    Name: "deepseek-coder:1.3b",
    Category: "code",
    description: `"Deepseek Coder is composed of a series of code language models, each trained from scratch on 2T tokens, with a composition of 87% code and 13% natural language in both English and Chinese. We provide various sizes of the code model, ranging from 1B to 33B versions. Each model is pre-trained on project-level code corpus by employing a window size of 16K and a extra fill-in-the-blank task, to support project-level code completion and infilling. For coding capabilities, Deepseek Coder achieves state-of-the-art performance among open-source code models on multiple programming languages and various benchmarks.\n\nMassive Training Data: Trained from scratch on 2T tokens, including 87% code and 13% linguistic data in both English and Chinese languages.\n\nHighly Flexible & Scalable: Offered in model sizes of 1.3B, 5.7B, 6.7B, and 33B, enabling users to choose the setup most suitable for their requirements.\n\nSuperior Model Performance: State-of-the-art performance among publicly available code models on HumanEval, MultiPL-E, MBPP, DS-1000, and APPS benchmarks.\n\nAdvanced Code Completion Capabilities: A window size of 16K and a fill-in-the-blank task, supporting project-level code completion and infilling tasks."`,
    Creator: "Deepseek",
    creatorUrl: "https://huggingface.co/deepseek-ai/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "16k",
    outputLength: undefined, // Not specified in data
    blogUrl: "https://deepseekcoder.github.io/",
    vectorSize: undefined
  },
  {
    Name: "deepseek-coder:6.7b",
    Category: "code",
    description: `"Deepseek Coder is composed of a series of code language models, each trained from scratch on 2T tokens, with a composition of 87% code and 13% natural language in both English and Chinese. We provide various sizes of the code model, ranging from 1B to 33B versions. Each model is pre-trained on project-level code corpus by employing a window size of 16K and a extra fill-in-the-blank task, to support project-level code completion and infilling. For coding capabilities, Deepseek Coder achieves state-of-the-art performance among open-source code models on multiple programming languages and various benchmarks.\n\nMassive Training Data: Trained from scratch on 2T tokens, including 87% code and 13% linguistic data in both English and Chinese languages.\n\nHighly Flexible & Scalable: Offered in model sizes of 1.3B, 5.7B, 6.7B, and 33B, enabling users to choose the setup most suitable for their requirements.\n\nSuperior Model Performance: State-of-the-art performance among publicly available code models on HumanEval, MultiPL-E, MBPP, DS-1000, and APPS benchmarks.\n\nAdvanced Code Completion Capabilities: A window size of 16K and a fill-in-the-blank task, supporting project-level code completion and infilling tasks."`,
    Creator: "Deepseek",
    creatorUrl: "https://huggingface.co/deepseek-ai/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "16k",
    outputLength: undefined, // Not specified in data
    blogUrl: "https://deepseekcoder.github.io/",
    vectorSize: undefined
  },
  {
    Name: "deepseek-coder-v2:16b",
    Category: "code",
    description: "We present DeepSeek-Coder-V2, an open-source Mixture-of-Experts (MoE) code language model that achieves performance comparable to GPT4-Turbo in code-specific tasks. Specifically, DeepSeek-Coder-V2 is further pre-trained from an intermediate checkpoint of DeepSeek-V2 with additional 6 trillion tokens. Through this continued pre-training, DeepSeek-Coder-V2 substantially enhances the coding and mathematical reasoning capabilities of DeepSeek-V2, while maintaining comparable performance in general language tasks. Compared to DeepSeek-Coder-33B, DeepSeek-Coder-V2 demonstrates significant advancements in various aspects of code-related tasks, as well as reasoning and general capabilities. Additionally, DeepSeek-Coder-V2 expands its support for programming languages from 86 to 338, while extending the context length from 16K to 128K.",
    Creator: "Deepseek",
    creatorUrl: "https://huggingface.co/deepseek-ai/",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("text"),
    contextSize: "128k",
    outputLength: undefined, // Not specified in data
    blogUrl: "https://deepseekcoder.github.io/",
    vectorSize: undefined
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
    vectorSize: undefined
  },
  {
    Name: "kokoro-82m",
    Category: "audio",
    description: "Kokoro is an open-weight TTS model with 82 million parameters. Despite its lightweight architecture, it delivers comparable quality to larger models while being significantly faster and more cost-efficient. With Apache-licensed weights, Kokoro can be deployed anywhere from production environments to personal projects.",
    Creator: "Hexgrad",
    creatorUrl: "https://huggingface.co/hexgrad",
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("voice"),
    contextSize: undefined, // N/A for TTS
    outputLength: undefined, // N/A for TTS
    blogUrl: undefined, // No blog post listed, HF page linked in creatorUrl
    vectorSize: undefined
  },
  {
    Name: "Wan-AI/Wan2.1-T2V-1.3B",
    Category: "video",
    description: `"Wan2.1, a comprehensive and open suite of video foundation models that pushes the boundaries of video generation. Wan2.1 offers these key features:\n\n👍 SOTA Performance: Wan2.1 consistently outperforms existing open-source models and state-of-the-art commercial solutions across multiple benchmarks.\n👍 Supports Consumer-grade GPUs: The T2V-1.3B model requires only 8.19 GB VRAM, making it compatible with almost all consumer-grade GPUs. It can generate a 5-second 480P video on an RTX 4090 in about 4 minutes (without optimization techniques like quantization). Its performance is even comparable to some closed-source models.\n👍 Multiple Tasks: Wan2.1 excels in Text-to-Video, Image-to-Video, Video Editing, Text-to-Image, and Video-to-Audio, advancing the field of video generation.\n👍 Visual Text Generation: Wan2.1 is the first video model capable of generating both Chinese and English text, featuring robust text generation that enhances its practical applications."`,
    Creator: "Wan AI",
    creatorUrl: "https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B", // Using HF as creator URL
    InputModalities: parseModalities("text"),
    OutputModalities: parseModalities("video"),
    contextSize: undefined, // N/A for video models
    outputLength: undefined, // N/A for video models
    blogUrl: undefined, // No blog post listed
    vectorSize: undefined
  },
];