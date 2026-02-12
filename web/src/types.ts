// Data models aligned with Firebase Realtime Database schema

export interface Studio {
  name: string;
  hamperCapacity: number;
  currentHamperCount: number;
}

export interface City {
  name: string;
  studios: Record<string, Studio>;
}

export interface UniformItem {
  name: string;
  size: string;
  barcode: string;
  status: string;
  category: string;
  studioLocation: string;
}

export interface GamePresenter {
  name: string;
  barcode: string;
}

export interface Assignment {
  id: string;
  gpName: string;
  itemName: string;
  size: string;
  date: string;
  itemBarcode: string;
  studio: string;
}

export interface LaundryOrder {
  id: string;
  items: string[];
  originStudio: string;
  timestamp: string;
}

export interface LogEntry {
  date: string;
  action: string;
  details: string;
}
