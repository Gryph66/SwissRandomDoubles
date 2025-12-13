import express, { type Request, type Response } from 'express';
import { queries } from '../db.js';
import { viewRateLimit } from '../middleware/rateLimit.js';
import { validateTournamentCode } from '../middleware/validation.js';

const router = express.Router();

router.get('/tournament/:code', viewRateLimit, (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    
    // Validate code format
    if (!validateTournamentCode(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tournament code format'
      });
    }
    
    // Retrieve tournament from database
    const row = queries.getTournament.get(code) as {
      code: string;
      name: string;
      data: string;
      created_at: number;
      expires_at: number;
      player_count: number;
      status: string;
    } | undefined;
    
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Tournament not found'
      });
    }
    
    // Check if expired
    const now = Date.now();
    if (row.expires_at < now) {
      // Delete expired tournament
      queries.deleteByCode.run(code);
      
      return res.status(410).json({
        success: false,
        message: 'Tournament has expired and been removed'
      });
    }
    
    // Parse tournament data
    const tournament = JSON.parse(row.data);
    
    // Return tournament with metadata
    res.json({
      success: true,
      tournament,
      metadata: {
        name: row.name,
        code: row.code,
        archivedAt: row.created_at,
        expiresAt: row.expires_at,
        playerCount: row.player_count,
        status: row.status
      }
    });
    
    console.log(`👁️  Viewed tournament: ${row.name} (${code})`);
    
  } catch (error) {
    console.error('❌ Retrieve error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve tournament'
    });
  }
});

// Health check endpoint for archive system
router.get('/archive/health', (_req: Request, res: Response) => {
  try {
    const stats = queries.getStats.get() as {
      total: number;
      total_size: number | null;
      next_expiration: number | null;
    };
    
    res.json({
      status: 'ok',
      database: 'connected',
      tournaments: stats.total || 0,
      storage: `${((stats.total_size || 0) / 1024 / 1024).toFixed(2)} MB`,
      nextExpiration: stats.next_expiration ? new Date(stats.next_expiration).toISOString() : null
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: (error as Error).message
    });
  }
});

export default router;
