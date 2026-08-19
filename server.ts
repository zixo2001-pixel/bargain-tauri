import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { monitorService } from './server/monitor';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- Production Health Check Endpoints (Root /health & /api/health) ---
  const handleHealth = (req: express.Request, res: express.Response) => {
    const health = monitorService.getHealthSummary();
    const statusCode = health.status === 'healthy' ? 200 : 200; // Return 200 for health checks so orchestrator doesn't restart during transient Tauri downtime
    res.status(statusCode).json({
      status: health.status,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      monitor: health
    });
  };

  app.get('/health', handleHealth);
  app.get('/api/health', handleHealth);

  // Get monitor status & public configuration
  app.get('/api/status', (req, res) => {
    const config = monitorService.getPublicConfig();
    const rules = monitorService.getRules();
    const activeRulesCount = rules.filter(r => r.enabled).length;
    const history = monitorService.getNotificationHistory();

    res.json({
      config,
      totalRules: rules.length,
      activeRules: activeRulesCount,
      recentAlertsCount: history.length
    });
  });

  // Update polling config (interval, active/pause, target AH URL)
  app.post('/api/config', (req, res) => {
    const updated = monitorService.updateConfig(req.body);
    res.json({ success: true, config: updated });
  });

  // Securely update sensitive secrets (Discord webhook URL, Tauri session cookies)
  // These are stored strictly on the server and never sent back in client API responses
  app.post('/api/secrets', (req, res) => {
    const result = monitorService.updateSecrets(req.body);
    res.json(result);
  });

  // Get rules
  app.get('/api/rules', (req, res) => {
    res.json(monitorService.getRules());
  });

  // Create rule
  app.post('/api/rules', (req, res) => {
    const { name, enabled, realm, characterClass, race, faction, minLevel, maxLevel, minItemLevel, maxItemLevel, minAchievementPoints, maxAchievementPoints, maxPrice } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Rule name is required.' });
      return;
    }

    const newRule = monitorService.createRule({
      name: name.trim(),
      enabled: enabled !== undefined ? Boolean(enabled) : true,
      realm: realm || 'Any',
      characterClass: characterClass || 'Any',
      race: race || 'Any',
      faction: faction || 'Any',
      minLevel: typeof minLevel === 'number' ? minLevel : minLevel ? parseInt(minLevel, 10) : null,
      maxLevel: typeof maxLevel === 'number' ? maxLevel : maxLevel ? parseInt(maxLevel, 10) : null,
      minItemLevel: typeof minItemLevel === 'number' ? minItemLevel : minItemLevel ? parseInt(minItemLevel, 10) : null,
      maxItemLevel: typeof maxItemLevel === 'number' ? maxItemLevel : maxItemLevel ? parseInt(maxItemLevel, 10) : null,
      minAchievementPoints: typeof minAchievementPoints === 'number' ? minAchievementPoints : minAchievementPoints ? parseInt(minAchievementPoints, 10) : null,
      maxAchievementPoints: typeof maxAchievementPoints === 'number' ? maxAchievementPoints : maxAchievementPoints ? parseInt(maxAchievementPoints, 10) : null,
      maxPrice: typeof maxPrice === 'number' ? maxPrice : maxPrice ? parseInt(maxPrice, 10) : null
    });

    res.status(201).json(newRule);
  });

  // Update rule
  app.put('/api/rules/:id', (req, res) => {
    const updated = monitorService.updateRule(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    res.json(updated);
  });

  // Toggle rule
  app.post('/api/rules/:id/toggle', (req, res) => {
    const toggled = monitorService.toggleRule(req.params.id);
    if (!toggled) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    res.json(toggled);
  });

  // Delete rule
  app.delete('/api/rules/:id', (req, res) => {
    const success = monitorService.deleteRule(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }
    res.json({ success: true });
  });

  // Test Rule against current live/cached listings without sending Discord alerts
  app.post('/api/rules/test', (req, res) => {
    try {
      const rule = req.body;
      if (!rule || typeof rule !== 'object') {
        res.status(400).json({ error: 'Rule object is required' });
        return;
      }
      const matches = monitorService.testRule(rule);
      res.json({
        success: true,
        matchesCount: matches.length,
        matches
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Send Test Discord Alert using a selected live listing
  app.post('/api/send-test-alert', async (req, res) => {
    try {
      const { listing, listingId, ruleName } = req.body || {};
      let targetListing = listing;
      if (!targetListing && listingId) {
        const cached = monitorService.getCachedListings();
        targetListing = cached.find(l => l.id === listingId);
      }

      if (!targetListing) {
        res.status(400).json({ error: 'Listing data or valid listingId is required' });
        return;
      }

      const result = await monitorService.sendTestAlertForListing(targetListing, ruleName || 'Manual Test Alert');
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Get cached AH listings
  app.get('/api/listings', (req, res) => {
    const listings = monitorService.getCachedListings();
    res.json(listings);
  });

  // Run Check Now (Fetch Tauri AH / evaluate rules / send Discord webhooks for new listings)
  app.post('/api/check-now', async (req, res) => {
    try {
      const customHtml = req.body?.customHtml;
      const result = await monitorService.runCheck(customHtml);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // Test Discord Webhook
  app.post('/api/test-discord', async (req, res) => {
    try {
      const { webhookUrl } = req.body || {};
      const result = await monitorService.testDiscordWebhook(webhookUrl);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // Test Tauri Connection (GET to TAURI_AH_URL with tSessionId cookie, parses HTML with Cheerio, returns count)
  app.post('/api/test-tauri', async (req, res) => {
    try {
      const { url, sessionCookie } = req.body || {};
      const result = await monitorService.testTauriConnection(url, sessionCookie);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        success: false,
        errorType: 'HTTP_ERROR',
        message: `Failed to execute connection test: ${msg}`
      });
    }
  });

  // Parse HTML test tool (for pasting custom HTML and verifying parsed data)
  app.post('/api/parse-html', (req, res) => {
    const html = req.body?.html;
    if (!html || typeof html !== 'string') {
      res.status(400).json({ error: 'HTML string is required' });
      return;
    }
    const result = monitorService.parseHtmlTest(html);
    res.json(result);
  });

  // Notification history
  app.get('/api/history', (req, res) => {
    res.json(monitorService.getNotificationHistory());
  });

  // Clear history
  app.post('/api/history/clear', (req, res) => {
    monitorService.clearHistory();
    res.json({ success: true });
  });

  // Reset notified IDs (allows re-alerting)
  app.post('/api/notified-ids/reset', (req, res) => {
    const result = monitorService.resetNotifiedIds();
    res.json({ success: true, resetCount: result.count });
  });

  // --- Vite / Static Assets Handling ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Tauri AH Monitor] Production server listening on 0.0.0.0:${PORT}`);
  });

  // Graceful shutdown on Railway container stop / redeployment
  const shutdown = (signal: string) => {
    console.log(`[Tauri AH Monitor] Received ${signal}. Shutting down gracefully...`);
    monitorService.stopPolling();
    monitorService.saveState();
    server.close(() => {
      console.log('[Tauri AH Monitor] HTTP server closed. State safely persisted.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Server startup error:', err);
});
