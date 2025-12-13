import type { Request, Response, NextFunction } from 'express';

const MAX_TOURNAMENT_SIZE_KB = parseInt(process.env.MAX_TOURNAMENT_SIZE_KB || '500');
const MAX_TOURNAMENT_SIZE_BYTES = MAX_TOURNAMENT_SIZE_KB * 1024;

export function validateTournamentCode(code: string): boolean {
  // Must be 6 alphanumeric characters
  const codeRegex = /^[A-Z0-9]{6}$/;
  return codeRegex.test(code);
}

export function validateTournamentData(tournament: any): { valid: boolean; error?: string } {
  // Check if tournament has required fields
  if (!tournament || typeof tournament !== 'object') {
    return { valid: false, error: 'Invalid tournament data' };
  }

  if (!tournament.id || !tournament.name) {
    return { valid: false, error: 'Tournament missing required fields (id, name)' };
  }

  if (!tournament.players || !Array.isArray(tournament.players)) {
    return { valid: false, error: 'Tournament missing players array' };
  }

  if (!tournament.matches || !Array.isArray(tournament.matches)) {
    return { valid: false, error: 'Tournament missing matches array' };
  }

  return { valid: true };
}

export function validateTournamentSize(data: any): { valid: boolean; error?: string; size?: number } {
  const sizeBytes = Buffer.byteLength(JSON.stringify(data), 'utf8');
  
  if (sizeBytes > MAX_TOURNAMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `Tournament data too large (${(sizeBytes / 1024).toFixed(2)}KB). Maximum size is ${MAX_TOURNAMENT_SIZE_KB}KB.`,
      size: sizeBytes
    };
  }

  return { valid: true, size: sizeBytes };
}

// Extend Express Request type to include tournamentSize
declare global {
  namespace Express {
    interface Request {
      tournamentSize?: number;
    }
  }
}

export function validateArchiveRequest(req: Request, res: Response, next: NextFunction) {
  const { tournament, code } = req.body;

  // Validate tournament data exists
  if (!tournament) {
    return res.status(400).json({
      success: false,
      message: 'Tournament data is required'
    });
  }

  // Validate tournament structure
  const structureValidation = validateTournamentData(tournament);
  if (!structureValidation.valid) {
    return res.status(400).json({
      success: false,
      message: structureValidation.error
    });
  }

  // Validate tournament size
  const sizeValidation = validateTournamentSize(tournament);
  if (!sizeValidation.valid) {
    return res.status(400).json({
      success: false,
      message: sizeValidation.error
    });
  }

  // Validate code if provided
  if (code && !validateTournamentCode(code)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid tournament code format. Must be 6 alphanumeric characters.'
    });
  }

  // Attach size to request for later use
  req.tournamentSize = sizeValidation.size;

  next();
}
