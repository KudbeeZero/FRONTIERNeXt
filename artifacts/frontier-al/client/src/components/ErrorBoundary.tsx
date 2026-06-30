import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback; defaults to the dark sci-fi panel below. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-phase errors in its subtree and shows a recoverable fallback
 * instead of letting the throw unmount the whole React root (which previously
 * blanked the game to a black screen — e.g. the BattleWatchModal hooks crash).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] caught render error:", error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          minHeight: 240,
          padding: "32px 24px",
          textAlign: "center",
          background: "#0a0a0f",
          color: "rgba(255,255,255,0.7)",
          fontFamily: "'Courier New', 'SF Mono', monospace",
        }}
      >
        <div style={{ fontSize: 15, letterSpacing: "0.08em" }}>Something went wrong</div>
        <button
          onClick={this.handleReload}
          style={{
            background: "rgba(60,100,255,0.18)",
            border: "1px solid rgba(100,160,255,0.45)",
            borderRadius: 8,
            padding: "10px 22px",
            color: "rgba(180,220,255,0.95)",
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
