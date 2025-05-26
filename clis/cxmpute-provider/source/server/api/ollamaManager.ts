import express, { Request, Response } from 'express';
import ollama from 'ollama'; // This works fine in the Node.js sidecar

const router = express.Router();

// POST /ollama/pull
router.post('/pull', async (req: Request, res: Response) => {
    const { model } = req.body;
    if (!model) {
        return res.status(400).json({ error: 'Missing model name in request body.' });
    }
    try {
        console.log(`Sidecar: Received pull request for model: ${model}`);
        // For non-streaming pull (simpler to start):
        await ollama.pull({ model, stream: false }); // stream: false makes it wait
        console.log(`Sidecar: Successfully pulled model: ${model}`);
        return res.status(200).json({ success: true, message: `Model ${model} pulled successfully.` });

        // // For streaming pull (more complex, sends progress):
        // res.setHeader('Content-Type', 'text/event-stream');
        // res.setHeader('Cache-Control', 'no-cache');
        // res.setHeader('Connection', 'keep-alive');
        // const stream = await ollama.pull({ model, stream: true });
        // for await (const part of stream) {
        //     res.write(`data: ${JSON.stringify(part)}\n\n`);
        // }
        // res.write(`data: ${JSON.stringify({status: 'completed', model: model})}\n\n`);
        // res.end();

    } catch (error: any) {
        console.error(`Sidecar: Error pulling model ${model}:`, error);
        return res.status(500).json({ error: `Failed to pull model ${model}: ${error.message}` });
    }
});

// POST /ollama/delete
router.post('/delete', async (req: Request, res: Response) => {
    const { model } = req.body;
    if (!model) {
        return res.status(400).json({ error: 'Missing model name.' });
    }
    try {
        await ollama.delete({ model });
        return res.status(200).json({ success: true, message: `Model ${model} deleted.` });
    } catch (error: any) {
        return res.status(500).json({ error: `Failed to delete model ${model}: ${error.message}` });
    }
});

// GET /ollama/list
router.get('/list', async (_req: Request, res: Response) => {
    try {
        const response = await ollama.list();
        return res.status(200).json(response.models); // response.models is an array
    } catch (error: any) {
        return res.status(500).json({ error: `Failed to list models: ${error.message}` });
    }
});

// GET /ollama/check (simple health check for Ollama service itself via sidecar)
router.get('/check', async (_req: Request, res: Response) => {
    try {
        await ollama.list(); // A light command to check connectivity
        return res.status(200).json({ status: "ok", message: "Ollama service is responsive via sidecar." });
    } catch (error: any) {
        console.error("Sidecar: Ollama check failed:", error);
        return res.status(500).json({ status: "error", message: "Ollama service not responsive via sidecar.", details: error.message });
    }
});


export default router;