import { Header } from './components/shared/Header';
import { TournamentSetup } from './components/setup/TournamentSetup';
import { RoundView } from './components/round/RoundView';
import { Standings } from './components/standings/Standings';
import { MatchHistory } from './components/history/MatchHistory';
import { SwissAnalysis } from './components/analysis/SwissAnalysis';
import { AdminPanel } from './components/admin/AdminPanel';
import { useTournamentStore } from './store/tournamentStore';

function App() {
  const { viewMode, tournament } = useTournamentStore();

  const renderContent = () => {
    // If no tournament exists, always show setup
    if (!tournament && viewMode !== 'setup') {
      return <TournamentSetup />;
    }

    switch (viewMode) {
      case 'setup':
        return <TournamentSetup />;
      case 'rounds':
        return <RoundView />;
      case 'standings':
        return <Standings />;
      case 'history':
        return <MatchHistory />;
      case 'analysis':
        return <SwissAnalysis />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <TournamentSetup />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <Header />
      <main className="pb-12">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;

