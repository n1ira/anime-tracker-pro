// Types for log-related hooks
export type Log = {
  id: number;
  level: string;
  message: string;
  createdAt: string;
};

export type LogSummary = {
  id: string;
  timestamp: string;
  show: string;
  target: string;
  status: string;
  details: string;
}; 