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
  