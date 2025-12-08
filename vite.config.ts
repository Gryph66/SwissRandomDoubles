import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git info for version tracking
function getGitInfo() {
  // Check for Railway environment variables first (Railway provides these during build)
  const railwayCommit = process.env.RAILWAY_GIT_COMMIT_SHA
  
  // Try local git first (works in both local dev and Railway since Railway clones the repo)
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
    const commitDate = execSync('git log -1 --format=%cd --date=short').toString().trim()
    const commitCount = execSync('git rev-list --count HEAD').toString().trim()
    return { commitHash, commitDate, commitCount }
  } catch {
    // Fallback for Railway if git commands fail
    if (railwayCommit) {
      return { 
        commitHash: railwayCommit.substring(0, 7), 
        commitDate: new Date().toISOString().split('T')[0],
        commitCount: '0'
      }
    }
    return { commitHash: 'dev', commitDate: new Date().toISOString().split('T')[0], commitCount: '0' }
  }
}

const gitInfo = getGitInfo()
const buildTime = new Date().toISOString()
// Version format: 0.1.{commitCount}
const version = `0.1.${gitInfo.commitCount}`

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_COMMIT__: JSON.stringify(gitInfo.commitHash),
    __GIT_DATE__: JSON.stringify(gitInfo.commitDate),
  },
  server: {
    port: 5177,
    // Use --host flag when running: npm run dev -- --host
  },
})
