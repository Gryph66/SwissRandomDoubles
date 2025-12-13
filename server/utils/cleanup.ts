import { db, queries } from '../db.js';

const MAX_TOTAL_TOURNAMENTS = parseInt(process.env.MAX_TOTAL_TOURNAMENTS || '1000');

export function cleanupExpiredTournaments() {
  const now = Date.now();
  
  try {
    // Delete expired tournaments
    const result = queries.deleteExpired.run(now);
    
    if (result.changes > 0) {
      console.log(`🗑️  Cleaned up ${result.changes} expired tournaments`);
    }
    
    // Enforce global limit
    const countResult = queries.getCount.get() as { count: number };
    const count = countResult.count;
    
    if (count > MAX_TOTAL_TOURNAMENTS) {
      const toDelete = count - MAX_TOTAL_TOURNAMENTS;
      const oldest = queries.getOldest.all(toDelete) as Array<{ code: string }>;
      
      oldest.forEach(row => {
        queries.deleteByCode.run(row.code);
      });
      
      console.log(`🗑️  Deleted ${toDelete} oldest tournaments to enforce limit (max: ${MAX_TOTAL_TOURNAMENTS})`);
    }
    
    return { success: true, deleted: result.changes };
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    return { success: false, error: (error as Error).message };
  }
}

// Run cleanup every hour
export function startCleanupSchedule() {
  console.log('🕐 Starting cleanup schedule (runs every hour)');
  
  // Run immediately on startup
  cleanupExpiredTournaments();
  
  // Then run every hour
  setInterval(cleanupExpiredTournaments, 60 * 60 * 1000);
}
