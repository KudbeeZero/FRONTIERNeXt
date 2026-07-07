import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { WalletProvider as UseWalletProvider } from "@txnlab/use-wallet-react";
import { WalletProvider, shouldAutoAuthenticateForPath } from "@/contexts/WalletContext";
import { walletManager } from "@/lib/walletManager";
import NotFound from "@/pages/not-found";
import GamePage from "@/pages/game";
import TestnetPage from "@/pages/testnet";
// "/" serves the static homepage (landing). Its "Enter Game" CTAs jump to the
// backend that serves the live game (see lib/gameUrl.ts) — so the landing can be
// hosted statically (Cloudflare Pages) while the game runs on its backend (Fly).
// "/game" mounts the gameplay page directly for the backend-served origin.
import LandingPage from "@/pages/landing";
import LandingEconomics from "@/pages/landing-economics";
import LandingGameplay from "@/pages/landing-gameplay";
import LandingFeatures from "@/pages/landing-features";
import LandingUpdates from "@/pages/landing-updates";
import PrivacyPolicy from "@/pages/privacy-policy";
import BattlesPage from "@/pages/battles";
import ArmoryPage from "@/pages/armory";
import UniversityPage from "@/pages/university";
// Lazy-loaded so the dashboard's chart library (recharts) is code-split out of
// the main bundle and only fetched when an operator opens /admin.
const AdminDashboard = lazy(() => import("@/pages/admin"));

function App() {
  const [location] = useLocation();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <UseWalletProvider manager={walletManager}>
            <Switch>
              {/* /university and /admin deliberately mount with NO wallet
                  context — neither touches chain/funds (see roadmap M2-3 /
                  U1 audit note). Kept outside the shared provider below. */}
              <Route path="/university">
                <UniversityPage />
              </Route>
              <Route path="/admin">
                <Suspense fallback={null}>
                  <AdminDashboard />
                </Suspense>
              </Route>
              <Route>
                {/* ONE shared WalletProvider instance for every other route.
                    Previously each <Route> mounted its own <WalletProvider>,
                    so a client-side nav between routes (no full page reload)
                    unmounted and remounted it — resetting its per-instance
                    auto-auth tracking and re-arming a duplicate signature
                    prompt for an address already authenticated on the
                    previous mount (audit finding P1). One persistent instance
                    here means navigating between these routes never remounts
                    it; autoAuth is derived from the current path instead of
                    being a static per-route prop. */}
                <WalletProvider autoAuth={shouldAutoAuthenticateForPath(location)}>
                  <Switch>
                    <Route path="/game">
                      <GamePage />
                    </Route>
                    <Route path="/">
                      <LandingPage />
                    </Route>
                    <Route path="/info/economics">
                      <LandingEconomics />
                    </Route>
                    <Route path="/info/gameplay">
                      <LandingGameplay />
                    </Route>
                    <Route path="/info/features">
                      <LandingFeatures />
                    </Route>
                    <Route path="/info/updates">
                      <LandingUpdates />
                    </Route>
                    <Route path="/testnet">
                      <TestnetPage />
                    </Route>
                    <Route path="/battles">
                      <BattlesPage />
                    </Route>
                    <Route path="/armory">
                      <ArmoryPage />
                    </Route>
                    <Route path="/privacy-policy">
                      <PrivacyPolicy />
                    </Route>
                    <Route>
                      <NotFound />
                    </Route>
                  </Switch>
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
