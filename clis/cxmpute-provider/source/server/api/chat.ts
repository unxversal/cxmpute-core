/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable @typescript-eslint/naming-convention */
import express from 'express';
import ollama from 'ollama';

const router = express.Router();

router.post('/', async (req, res) => {
  // Extract required fields from the request body.
  // For OpenAI compatibility, people will pass 'response_format' and 'functions',
  // but we need to rename them to 'format' and 'tools' for Ollama.
  const {
    model,
    messages,
    stream,
    response_format, // e.g. { type: 'json_schema', ... } or 'json'
    functions,       // e.g. [ { name, description, parameters, strict: true }, ... ]
    ...options       // e.g. temperature, max_tokens, stop, etc.
  } = req.body;

  // Validate required parameters: model and messages must be provided.
  if (!model || !messages) {
    return res.status(400).json({ error: 'Missing required parameter: model or messages' });
  }

  // Adjust parameter names to what Ollama expects
  //
  // 1) 'response_format' => 'format'
  // 2) 'functions'       => 'tools'
  // 3) everything else passes through as-is in 'options'
  //
  // If response_format is present, we’ll map it over. For example:
  //   { type: "json_object" } => format: "json"
  //   { type: "json_schema", ... } => format: "json"
  //   or a plain string => format: "json"
  //   or for chain-of-thought, you'd keep "json" too
  //
  // If you want to handle multiple possible "response_format" values more explicitly,
  // you can do that here. For now, let's simply set format = response_format
  // if it's present.
  if (response_format) {
    // If the user provided an object, check if `type: "json_..."` is there.
    // We'll do a simple approach: if it's an object, or "json"/"json_schema",
    // we override to "json" so Ollama returns valid JSON content.
    if (typeof response_format === 'string') {
      // e.g. "json", "text", "markdown", etc.
      options.format = response_format;
    } else if (typeof response_format === 'object') {
      // If { type: 'json_schema', ... }, or { type: 'json_object' }, etc.
      options.format = JSON.stringify(response_format);
    }
    // else fallback or custom logic as desired
  }

  // Convert 'functions' => 'tools'
  // In OpenAI's docs, we define an array of "functions". In Ollama, it's the "tools" array.
  // We’ll rename accordingly.
  if (functions) {
    // If you are receiving them in the OpenAI format
    // { name, description, parameters } => the same shape is acceptable for 'tools' in Ollama
    // Just rename it:
    options.tools = functions;
  }

  try {
    // Construct the payload that Ollama expects
    // By now, we have:
    //   - model, messages
    //   - possibly options.format
    //   - possibly options.tools
    //   - plus any other advanced params user set
    const payload = { model, messages, ...options };

    if (stream) {
      // Set headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Call Ollama with stream enabled => returns an AsyncGenerator
      const responseStream = await ollama.chat({ ...payload, stream: true });

      // Iterate over the async generator and send each part as an SSE message
      for await (const part of responseStream) {
        // Send the chunk as SSE
        res.write(`data: ${JSON.stringify(part)}\n\n`);
      }

      // Signal the end of the stream
      res.end();
    } else {
      // For non-streaming requests: await the full response from Ollama
      const response = await ollama.chat(payload);

      // according to the docs, ollama.chat returns:
      // interface ChatResponse {
      //   model: string
      //   created_at: Date
      //   message: Message
      //   done: boolean
      //   done_reason: string
      //   total_duration: number
      //   load_duration: number
      //   prompt_eval_count: number
      //   prompt_eval_duration: number
      //   eval_count: number
      //   eval_duration: number
      // }

      res.json(response);
    }
    return;
  } catch (error) {
    console.error('Error in /chat/completions:', error);
    res.status(500).json({ error: (error as Error).message });
    return;
  }
});

export default router;
