// Types for scan-related hooks
export type Show = {
  id: number;
  title: string;
  [key: string]: any;
};

export type ScanState = {
  id: number;
  isScanning: boolean;
  currentShowId: number | null;
  status: string;
  startedAt: string | null;
  updatedAt: string;
  currentShow: Show | null;
};

export type ScanResult = {
  success: boolean;
  message: string;
};
