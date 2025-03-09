"use client";

import React, { Suspense } from 'react';

// Default loading component
const DefaultLoading = () => (
  <div className="flex items-center justify-center p-4 h-full w-full min-h-[200px]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
  </div>
);

/**
 * Utility function to lazy load components with a loading fallback
 * @param importFn - Dynamic import function
 * @param LoadingComponent - Optional custom loading component
 * @returns Lazy loaded component with Suspense
 */
export function lazyLoad<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  LoadingComponent: React.ComponentType = DefaultLoading
) {
  const LazyComponent = React.lazy(importFn);
  
  const LazyLoadedComponent = (props: React.ComponentProps<T>) => (
    <Suspense fallback={<LoadingComponent />}>
      <LazyComponent {...props} />
    </Suspense>
  );
  
  // Set display name for the component
  const componentName = importFn.toString().match(/\/([^/]+)'/)?.[1] || 'LazyComponent';
  LazyLoadedComponent.displayName = `LazyLoaded(${componentName})`;
  
  return LazyLoadedComponent;
} 