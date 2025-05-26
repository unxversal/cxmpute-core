import express from 'express';
import chat from './chat.js';
import MessageResponse from '../interfaces/MessageResponse.js';

const router = express.Router();

router.get<{}, MessageResponse>('/', (_req, res) => {
  res.json({
    message: 'API - 👋🌎🌍🌏🐬',
  });
});

router.use('/chat/completions', chat);

export default router;
