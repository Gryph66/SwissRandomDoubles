import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Get git info for version tracking
function getGitInfo() {
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim()
    const commitDate = execSync('git log -1 --format=%cd --date=short').toString().trim()
    return { commitHash, commitDate }
  } catch {
    return { commitHash: 'dev', commitDate: new Date().toISOString().split('T')[0] }
  }
}

const gitInfo = getGitInfo()
const buildTime = new Date().toISOString()

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('0.1.0'),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_COMMIT__: JSON.stringify(gitInfo.commitHash),
    __GIT_DATE__: JSON.stringify(gitInfo.commitDate),
  },
  server: {
    port: 5177,
    // Use --host flag when running: npm run dev -- --host
  },
})
