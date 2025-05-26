/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable import/no-extraneous-dependencies */
import express from 'express';
import ollama from 'ollama';

const router = express.Router();

/**
 * POST /embeddings
 *
 * Body:
 *  {
 *    "model": <string>        // required
 *    "input": <string|string[]>, // required
 *    "truncate": <boolean>,   // optional
 *    "keep_alive": <string|number>, // optional
 *    ...options               // optional Ollama runtime options
 *  }
 *
 * Response:
 *  {
 *    "model": string,
 *    "embeddings": number[][],
 *    "total_duration": number,
 *    "load_duration": number,
 *    "prompt_eval_count": number
 *  }
 */
router.post('/', async (req, res) => {
  const {
    model,
    input,
    truncate,
    keep_alive,
    ...options // e.g. other runtime params like temperature, repetition_penalty, etc.
  } = req.body;

  if (!model || !input) {
    return res.status(400).json({ error: 'Missing required parameters: model, input' });
  }

  try {
    const payload = {
      model,
      input,
      // Only add fields if they are actually provided
      ...(truncate !== undefined && { truncate }),
      ...(keep_alive !== undefined && { keep_alive }),
      options,
    };

    // Call ollama's embed function:
    const result = await ollama.embed(payload);

    // result has the form:
    // {
    //   model: string,
    //   embeddings: number[][],
    //   total_duration: number,
    //   load_duration: number,
    //   prompt_eval_count: number
    // }

    return res.json(result);
  } catch (error) {
    console.error('Error in /embeddings:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;