"use client";

import { useState, useCallback, useMemo } from 'react';
import { Log, LogSummary } from './types';

type LogLevelFilter = {
  info: boolean;
  warning: boolean;
  error: boolean;
  debug: boolean;
};

export function useLogFilter(logs: Log[], summaries: LogSummary[]) {
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevelFilter>({
    info: true,
    warning: true,
    error: true,
    debug: true
  });
  const [showSummaryOnly, setShowSummaryOnly] = useState(false);

  // Filter logs based on search term and level filters
  const filteredLogs = useMemo(() => {
    if (showSummaryOnly) return [];

    return logs.filter(log => {
      // Check if log level is enabled in filter
      const level = log.level.toLowerCase();
      const isLevelEnabled = 
        (level === 'info' && levelFilter.info) ||
        (level === 'warning' && levelFilter.warning) ||
        (level === 'error' && levelFilter.error) ||
        (level === 'debug' && levelFilter.debug);

      // Check if log matches search term
      const matchesSearch = searchTerm === '' || 
        log.message.toLowerCase().includes(searchTerm.toLowerCase());

      return isLevelEnabled && matchesSearch;
    });
  }, [logs, searchTerm, levelFilter, showSummaryOnly]);

  // Filter summaries based on search term
  const filteredSummaries = useMemo(() => {
    if (searchTerm === '') return summaries;
    
    return summaries.filter(summary =>
      summary.show.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.target.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [summaries, searchTerm]);

  // Toggle individual log level filter
  const toggleLevelFilter = useCallback((level: keyof LogLevelFilter) => {
    setLevelFilter(prev => ({
      ...prev,
      [level]: !prev[level]
    }));
  }, []);

  // Toggle "summary only" view
  const toggleSummaryOnly = useCallback(() => {
    setShowSummaryOnly(prev => !prev);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    levelFilter,
    toggleLevelFilter,
    showSummaryOnly,
    toggleSummaryOnly,
    filteredLogs,
    filteredSummaries
  };
} 