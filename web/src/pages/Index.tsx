import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { TabNavigation } from '@/components/layout/TabNavigation';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { StockExplorer } from '@/components/explorer/StockExplorer';
import { PortfolioBuilder } from '@/components/portfolio/PortfolioBuilder';
import { BacktestPanel } from '@/components/backtest/BacktestPanel';
import { SignalPanel } from '@/components/signals/SignalPanel';
import { AdvisoryPanel } from '@/components/advisory/AdvisoryPanel';
import { SimulationPanel } from '@/components/simulation/SimulationPanel';
import { KnowledgePanel } from '@/components/knowledge/KnowledgePanel';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <MarketOverview />;
      case 'explorer':
        return <StockExplorer />;
      case 'portfolio':
        return <PortfolioBuilder />;
      case 'backtest':
        return <BacktestPanel />;
      case 'signals':
        return <SignalPanel />;
      case 'advisory':
        return <AdvisoryPanel />;
      case 'simulation':
        return <SimulationPanel />;
      case 'knowledge':
        return <KnowledgePanel />;
      default:
        return <MarketOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="container mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
};

export default Index;
