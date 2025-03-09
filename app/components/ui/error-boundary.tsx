'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="shadow-md border-t-4 border-t-destructive max-w-lg mx-auto my-8">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-bold text-destructive">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-destructive/10 text-destructive rounded-md px-4 py-3 text-sm font-medium border border-destructive/20">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Please try refreshing the page or navigating back to the previous page.
            </p>
          </CardContent>
          <CardFooter className="pt-4 pb-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => window.history.back()}>
              Go Back
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary }; 