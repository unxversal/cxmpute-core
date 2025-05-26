/* eslint-disable import/no-extraneous-dependencies */
import { Router, Request, Response } from 'express';
import { KokoroTTS } from 'kokoro-js';

const router = Router();

// 1) Choose your model ID (the ONNX version).
const modelId = 'onnx-community/Kokoro-82M-ONNX';

// 2) We’ll store the loaded TTS model in a variable:
let tts: KokoroTTS;

// 3) Load the TTS model. If you prefer not to rely on top-level await,
// you can wrap it in an async IIFE as shown below.
(async () => {
  try {
    tts = await KokoroTTS.from_pretrained(modelId, {
      dtype: 'q8', // or 'fp32', 'fp16', 'q4f16'
    });
    console.log('Kokoro TTS model loaded.');
  } catch (err) {
    console.error('Error loading Kokoro TTS model:', err);
  }
})();

// const voiceOptions = [ 'af', 'af_bella', 'af_nicole', 'af_sarah', 'af_sky', 'am_adam', 'am_michael', 'bf_emma', 'bf_isabella', 'bm_george', 'bm_lewis']

/**
 * POST /api/v1/tts
 *
 * JSON body:
 * {
 *   "text": "Hello world!",
 *   "voice": "af_bella"  // optional
 * }
 *
 * Returns a WAV audio stream.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, voice = 'af_bella' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS.' });
    }

    // 4) Generate speech using the loaded TTS model.
    //    The .generate() call returns an Audio object (see kokoro-js docs).
    const audio = await tts.generate(text, {
      voice, // optional: pass a specific voice ID
    });

    // 5) Stream back the audio as a WAV file.
    //    By default, kokoro-js returns a WAV in the Audio object.
    res.setHeader('Content-Type', 'audio/wav');
    const wavData = audio.toWav();
    res.send(Buffer.from(wavData));
    return;
  } catch (error) {
    console.error('Error in /tts route:', error);
    res.status(500).json({ error: (error as Error).message });
    return;
  }
});

export default router;