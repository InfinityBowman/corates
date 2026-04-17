/**
 * SectionErrorBoundary - Catches errors in a section and shows a fallback UI
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { captureException } from '@/config/sentry';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.name}:`, error, errorInfo);
    captureException(error, {
      component: 'SectionErrorBoundary',
      action: 'render',
      section: this.props.name,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className='border-border bg-card rounded-lg border p-6 text-center'>
          <p className='text-foreground font-medium'>Something went wrong in {this.props.name}</p>
          <p className='text-muted-foreground mt-1 text-sm'>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className='text-primary hover:text-primary/80 mt-3 text-sm font-medium'
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
