/* eslint-disable import/no-extraneous-dependencies */
import { Router, Request, Response } from 'express';
import TurndownService from 'turndown';

const router = Router();

// You can adjust this on the backend
const MAX_URLS = 5;

// Prepare a Turndown instance for HTML→Markdown conversion
const turndown = new TurndownService();

/**
 * POST /api/v1/scrape
 *
 * Body:
 * {
 *   "urls": ["https://example.com", "https://google.com"],
 *   "format": "markdown" | "html"
 * }
 *
 * Returns JSON with scraped content for up to MAX_URLS.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { urls, format = 'html' } = req.body;

    // Validate user input
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Provide at least one URL in "urls" array.' });
    }

    // Enforce the max number of URLs
    const limitedUrls = urls.slice(0, MAX_URLS);

    const results = [];

    for (const url of limitedUrls) {
      try {
        // Node 22+ has a built-in global 'fetch' – no need for node-fetch
        const resp = await fetch(url);
        if (!resp.ok) {
          results.push({
            url,
            error: `HTTP ${resp.status}: ${resp.statusText}`,
          });
          continue;
        }

        const html = await resp.text();

        // Convert to Markdown if requested
        if (format === 'markdown') {
          const markdown = turndown.turndown(html);
          results.push({ url, data: markdown });
        } else {
          // default: return HTML
          results.push({ url, data: html });
        }
      } catch (err) {
        // Handle fetch/network errors
        results.push({
          url,
          error: String(err),
        });
      }
    }

    // Return all results
    return res.json({ results });
  } catch (error) {
    console.error('Error in /scrape route:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;