import express, { type Request, type Response } from 'express';
import { queries } from '../db.js';
import { archiveRateLimit } from '../middleware/rateLimit.js';
import { validateArchiveRequest } from '../middleware/validation.js';
import { nanoid } from 'nanoid';

const router = express.Router();

const MAX_TOTAL_TOURNAMENTS = parseInt(process.env.MAX_TOTAL_TOURNAMENTS || '1000');
const TOURNAMENT_EXPIRATION_DAYS = parseInt(process.env.TOURNAMENT_EXPIRATION_DAYS || '90');

router.post('/archive', archiveRateLimit, validateArchiveRequest, async (req: Request, res: Response) => {
  try {
    const { tournament, code } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    
    // Check global tournament limit
    const countResult = queries.getCount.get() as { count: number };
    if (countResult.count >= MAX_TOTAL_TOURNAMENTS) {
      return res.status(429).json({
        success: false,
        message: `Tournament archive limit reached (${MAX_TOTAL_TOURNAMENTS} max). Please try again later.`
      });
    }
    
    // Generate or use provided code
    const tournamentCode = code || nanoid(6).toUpperCase();
    
    // Calculate expiration (90 days from now)
    const now = Date.now();
    const expiresAt = now + (TOURNAMENT_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);
    
    // Prepare tournament data
    const tournamentData = JSON.stringify(tournament);
    const sizeBytes = req.tournamentSize || 0; // Set by validation middleware
    const playerCount = tournament.players?.length || 0;
    const status = tournament.status || 'unknown';
    
    // Save to database
    queries.saveTournament.run(
      tournamentCode,
      tournament.name,
      tournamentData,
      now,
      expiresAt,
      ip,
      sizeBytes,
      playerCount,
      status
    );
    
    // Generate shareable URL
    // In development, use the Vite dev server port (5177)
    // In production, use BASE_URL environment variable or the request host
    let baseUrl: string;
    if (process.env.NODE_ENV === 'production') {
      baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    } else {
      // Development: use Vite dev server
      baseUrl = 'http://localhost:5177';
    }
    const url = `${baseUrl}/view/${tournamentCode}`;
    
    console.log(`📦 Archived tournament: ${tournament.name} (${tournamentCode}) - ${(sizeBytes / 1024).toFixed(2)}KB`);
    
    res.json({
      success: true,
      code: tournamentCode,
      url,
      expiresAt,
      message: 'Tournament archived successfully'
    });
    
  } catch (error) {
    console.error('❌ Archive error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to archive tournament. Please try again.'
    });
  }
});

export default router;
