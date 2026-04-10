import React, { Component, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
  /** * Fallback to React Node or implement render logic using error object 
   * and reset function
   * @example
   * <ErrorBoundary 
        fallback={(error, reset) => (
        <div role="alert">
            <h2>Something went wrong!</h2>
            <p>{error.message}</p>
            <button onClick={reset}>Try Again</button>
        </div>
    )}>
        <CorruptComponent />
    </ErrorBoundary>
   */
  fallback: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null 
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Utilize with Logger e.g. Sentry, Datadog, Loki.
   * @param error 
   * @param info 
   */
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error);
    console.error("Component stack trace:", info.componentStack);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error!, this.resetErrorBoundary);
      }
      
      return this.props.fallback;
    }

    return this.props.children;
  }
}