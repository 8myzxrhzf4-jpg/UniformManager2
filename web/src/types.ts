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

export interface LogEntry {
  date: string;
  action: string;
  details: string;
}

// Game Presenter (GP) interface
export interface GamePresenter {
  name: string;
  barcode?: string;
  city?: string;
  studio?: string;
}

// Assignment tracking
export interface Assignment {
  itemBarcode: string;
  itemName: string;
  itemSize: string;
  gpName: string;
  gpBarcode?: string;
  issuedAt: string;
  returnedAt?: string;
  status: 'active' | 'returned';
  city: string;
  studio: string;
}

// Laundry order tracking
export interface LaundryOrder {
  orderNumber: string;
  items: string[]; // Array of item barcodes
  createdAt: string;
  pickedUpAt?: string;
  returnedAt?: string;
  status: 'pending' | 'picked_up' | 'returned';
  city: string;
  studio: string;
  itemCount: number;
}

// Damage record
export interface DamageRecord {
  itemBarcode: string;
  itemName: string;
  damageType: 'damaged' | 'lost';
  reportedAt: string;
  reportedBy?: string;
  notes?: string;
  city: string;
  studio: string;
}

// Analytics: Audit history entry
export interface AuditHistoryEntry {
  weekId: string; // Format: YYYY-WW (e.g., 2026-06)
  itemBarcode: string;
  itemName: string;
  itemSize: string;
  expectedCount: number;
  actualCount: number;
  delta: number; // actualCount - expectedCount
  auditedAt: string;
  auditedBy?: string;
}

// Analytics: Weekly audit list
export interface WeeklyAuditItem {
  barcode: string;
  name: string;
  size: string;
  category: string;
  rationale: string; // Why this item was selected
  expectedLocation: string;
}

export interface WeeklyAuditList {
  weekId: string; // Format: YYYY-WW
  generatedAt: string;
  items: WeeklyAuditItem[];
  city: string;
  studio: string;
}

// Analytics: GP routine issue summary
export interface GPIssueSummary {
  gpName: string;
  gpBarcode?: string;
  issueCount: number;
  lastIssued?: string;
  items: Record<string, number>; // itemName -> count
}

// Analytics: Item demand summary
export interface ItemDemandSummary {
  itemName: string;
  size: string;
  category: string;
  totalIssued: number;
  avgPerWeek: number;
  suggestedStock: number; // avgPerWeek * safetyFactor
}

// Analytics: Item lifespan summary
export interface ItemLifespanSummary {
  category: string;
  avgLifespanDays: number;
  medianLifespanDays?: number;
  sampleSize: number;
  minLifespanDays?: number;
  maxLifespanDays?: number;
}

// CSV Import types
export interface CSVImportRow {
  name: string;
  size: string;
  barcode: string;
  status: string;
  category: string;
  studioLocation: string;
}

export interface CSVImportError {
  row: number;
  field: string;
  message: string;
}

export interface CSVImportResult {
  success: boolean;
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: CSVImportError[];
}
