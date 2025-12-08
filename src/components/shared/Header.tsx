import { useState, useEffect } from 'react';
import { useTournamentStore } from '../../store/tournamentStore';
import type { ViewMode } from '../../types';

const navItems: { mode: ViewMode; label: string; requiresTournament: boolean; large?: boolean; hostOnly?: boolean }[] = [
  { mode: 'setup', label: 'Setup', requiresTournament: false, hostOnly: true },
  { mode: 'schedule', label: 'Schedule', requiresTournament: true, large: true },
  { mode: 'history', label: 'Score Entry', requiresTournament: true },
  { mode: 'rounds', label: 'Round Results', requiresTournament: true },
  { mode: 'standings', label: 'Standings', requiresTournament: true },
  { mode: 'analysis', label: 'Analysis', requiresTournament: true },
  { mode: 'admin', label: 'Admin', requiresTournament: true, hostOnly: true },
];

interface HeaderProps {
  connectedCount?: number;
  isOnline?: boolean;
  isConnected?: boolean;
  isHost?: boolean;
  showQRCode?: boolean;
  onToggleQRCode?: () => void;
}

export function Header({ connectedCount, isOnline, isConnected, isHost: isHostProp, showQRCode, onToggleQRCode }: HeaderProps) {
  const { tournament, viewMode, setViewMode, isHost: storeIsHost } = useTournamentStore();
  const isHost = isHostProp ?? storeIsHost;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVersionInfo, setShowVersionInfo] = useState(false);

  // Get build info
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const gitCommit = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'local';
  const gitDate = typeof __GIT_DATE__ !== 'undefined' ? __GIT_DATE__ : '';
  const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <header className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--color-bg-primary)]">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-display font-semibold text-[var(--color-text-primary)]">
                {tournament?.name || 'Swiss Doubles'}
              </h1>
              {tournament && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Round {tournament.currentRound} of {tournament.totalRounds}
                  {tournament.status === 'completed' && ' - Complete'}
                </p>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isDisabled = item.requiresTournament && !tournament;
              const isActive = viewMode === item.mode;
              // Hide host-only items from non-hosts
              const showItem = !item.hostOnly || isHost;

              if (!showItem) return null;

              return (
                <button
                  key={item.mode}
                  onClick={() => !isDisabled && setViewMode(item.mode)}
                  disabled={isDisabled}
                  className={`
                    ${item.large ? 'px-5 py-2 text-base' : 'px-3 py-2 text-sm'} font-medium rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]'
                    }
                    ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                  `}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Connection Status, Share Code & Fullscreen */}
          <div className="flex items-center gap-4">
            {/* Connection indicator */}
            {isOnline && (
              <div 
                className="flex items-center gap-2 cursor-pointer relative"
                onClick={() => setShowVersionInfo(!showVersionInfo)}
                title="Click for version info"
              >
                {isConnected ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-green-400">
                      Connected
                    </span>
                    {connectedCount && connectedCount > 1 && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        ({connectedCount})
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-xs text-red-400">
                      Disconnected
                    </span>
                  </>
                )}
                
                {/* Version info popup */}
                {showVersionInfo && (
                  <div className="absolute top-full right-0 mt-2 p-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-lg shadow-lg z-50 whitespace-nowrap">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-[var(--color-text-muted)]">Version:</span>
                        <span className="text-[var(--color-text-primary)] font-mono">{version}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-[var(--color-text-muted)]">Build:</span>
                        <span className="text-[var(--color-accent)] font-mono">{gitCommit}</span>
                      </div>
                      {gitDate && (
                        <div className="flex justify-between gap-4">
                          <span className="text-[var(--color-text-muted)]">Date:</span>
                          <span className="text-[var(--color-text-secondary)] font-mono">{gitDate}</span>
                        </div>
                      )}
                      {buildTime && (
                        <div className="flex justify-between gap-4">
                          <span className="text-[var(--color-text-muted)]">Built:</span>
                          <span className="text-[var(--color-text-secondary)] font-mono text-[10px]">
                            {new Date(buildTime).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {tournament && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">Code:</span>
                <code className="px-2 py-1 bg-[var(--color-bg-tertiary)] rounded text-sm font-mono text-[var(--color-accent)]">
                  {tournament.shareCode}
                </code>
              </div>
            )}
            
            {/* QR Code Toggle - only for host in online mode */}
            {isOnline && isHost && tournament?.shareCode && onToggleQRCode && (
              <button
                onClick={onToggleQRCode}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/10 transition-colors"
              >
                {showQRCode ? 'Hide QR' : 'Show QR'}
              </button>
            )}
            
            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

