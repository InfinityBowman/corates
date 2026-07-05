/**
 * SectionErrorBoundary - Catches errors in a section and shows a fallback UI
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { captureException } from '@/config/sentry';
import { TriangleAlertIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
        <div className='border-border bg-card rounded-xl border p-8 text-center shadow-sm'>
          <div className='bg-destructive/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full'>
            <TriangleAlertIcon className='text-destructive size-6' />
          </div>
          <h3 className='text-foreground mb-1 text-base font-semibold'>
            Something went wrong in {this.props.name}
          </h3>
          <p className='text-muted-foreground mb-5 text-sm'>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => this.setState({ hasError: false, error: null })}>
            <RefreshCwIcon className='size-3.5' />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
