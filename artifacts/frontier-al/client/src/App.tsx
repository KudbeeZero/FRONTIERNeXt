import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider as UseWalletProvider } from "@txnlab/use-wallet-react";
import { WalletProvider } from "@/contexts/WalletContext";
import { walletManager } from "@/lib/walletManager";
import NotFound from "@/pages/not-found";
import GamePage from "@/pages/game";
import TestnetPage from "@/pages/testnet";
import LandingPage from "@/pages/landing";
import LandingEconomics from "@/pages/landing-economics";
import LandingGameplay from "@/pages/landing-gameplay";
import LandingFeatures from "@/pages/landing-features";
import LandingUpdates from "@/pages/landing-updates";
import PrivacyPolicy from "@/pages/privacy-policy";
import BattlesPage from "@/pages/battles";
import AdminDashboard from "@/pages/admin";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <UseWalletProvider manager={walletManager}>
            <Switch>
              <Route path="/game">
                <WalletProvider>
                  <GamePage />
                </WalletProvider>
              </Route>
              <Route path="/">
                <WalletProvider>
                  <LandingPage />
                </WalletProvider>
              </Route>
              <Route path="/info/economics">
                <WalletProvider>
                  <LandingEconomics />
                </WalletProvider>
              </Route>
              <Route path="/info/gameplay">
                <WalletProvider>
                  <LandingGameplay />
                </WalletProvider>
              </Route>
              <Route path="/info/features">
                <WalletProvider>
                  <LandingFeatures />
                </WalletProvider>
              </Route>
              <Route path="/info/updates">
                <WalletProvider>
                  <LandingUpdates />
                </WalletProvider>
              </Route>
              <Route path="/testnet">
                <WalletProvider>
                  <TestnetPage />
                </WalletProvider>
              </Route>
              <Route path="/battles">
                <WalletProvider>
                  <BattlesPage />
                </WalletProvider>
              </Route>
              <Route path="/admin">
                <AdminDashboard />
              </Route>
              <Route path="/privacy-policy">
                <WalletProvider>
                  <PrivacyPolicy />
                </WalletProvider>
              </Route>
              <Route>
                <WalletProvider>
                  <NotFound />
                </WalletProvider>
              </Route>
            </Switch>
          </UseWalletProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
