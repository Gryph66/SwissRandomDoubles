import { QRCodeSVG } from 'qrcode.react';
import { useTournamentStore } from '../../store/tournamentStore';

interface FloatingQRCodeProps {
  isOnline: boolean;
  isHost: boolean;
  isVisible: boolean;
  onToggle: () => void;
}

export function FloatingQRCode({ isOnline, isHost, isVisible, onToggle }: FloatingQRCodeProps) {
  const { tournament } = useTournamentStore();
  
  // Only show for host in online mode with an active tournament
  if (!isOnline || !isHost || !tournament?.shareCode) {
    return null;
  }
  
  const shareUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}?code=${tournament.shareCode}`
    : '';
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-4 transition-all duration-200">
        <div className="text-center mb-2">
          <span className="text-xs font-bold text-gray-600 tracking-wide">SCAN TO JOIN</span>
          <div className="text-lg font-mono font-bold text-[var(--color-accent)] tracking-wider">
            {tournament.shareCode}
          </div>
        </div>
        <QRCodeSVG value={shareUrl} size={160} />
        <button
          onClick={onToggle}
          className="mt-3 w-full py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Hide QR Code
        </button>
      </div>
    </div>
  );
}

