// Data models aligned with Firebase Realtime Database schema

// Valid uniform status values
export type UniformStatus =
  | 'Available'
  | 'In Stock'     // legacy → treated as Available
  | 'Issued'
  | 'In Hamper'
  | 'At Laundry'
  | 'Damaged'
  | 'Lost';

// Valid role types
export type UserRole = 'Super User' | 'Admin' | 'City Admin' | 'Staff';
export type AccountStatus = 'pending' | 'approved' | 'rejected';

// ── NEW: user record stored in Firebase users/{uid} ───────────────────────────
export interface UserRecord {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  status: AccountStatus;
  requestedAt: string;
  requestedCity?: string;   // ✅ ADD THIS
  approvedAt?: string;
  assignedCities?: string[];
}

export interface Studio {
  name: string;
  hamperCapacity: number;
  currentHamperCount: number;
}

export interface City {
  name: string;
  studios: Record<string, Studio>;
  laundryEnabled?: boolean; // defaults to true when absent
}

export interface UniformItem {
  name: string;
  size: string;
  barcode: string;
  status: UniformStatus | string;
  category: string;
  studioLocation: string;
  issuedAtStudio?: string;
  issuedAtCity?: string;
  issuedBy?: string;
  issuedAt?: string;
  returnedAtStudio?: string;
  returnedBy?: string;
  returnedAt?: string;
}

export interface LogEntry {
  date: string;
  action: string;
  details: string;
}

export interface GamePresenter {
  name: string;
  barcode?: string;
  city?: string;
  studio?: string;
  terminated?: boolean;
  terminatedAt?: string;
}

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  city?: string;
  studios?: string[];
}

export interface Assignment {
  itemBarcode: string;
  itemName: string;
  itemSize: string;
  gpName: string;
  gpBarcode?: string;
  issuedAt: string;
  issuedAtStudio: string;
  issuedAtCity: string;
  issuedBy?: string;
  returnedAt?: string;
  returnedAtStudio?: string;
  returnedBy?: string;
  status: 'active' | 'returned';
  city: string;
  studio: string;
  issueReason?: string;
  issueReasonLabel?: string;
}

export interface LaundryOrder {
  orderNumber: string;
  items: string[];
  createdAt: string;
  pickedUpAt?: string;
  returnedAt?: string;
  status: 'pending' | 'picked_up' | 'returned';
  city: string;
  studio: string;
  itemCount: number;
}

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

export interface AuditHistoryEntry {
  weekId: string;
  itemBarcode: string;
  itemName: string;
  itemSize: string;
  expectedCount: number;
  actualCount: number;
  delta: number;
  auditedAt: string;
  auditedBy?: string;
}

export interface AuditSession {
  id: string;
  category: string;
  size: string;
  studio: string;
  studioKey: string;
  city: string;
  cityKey: string;
  startedAt: string;
  startedBy: string;
  completedAt?: string;
  expectedBarcodes: string[];
  scannedBarcodes: string[];
  missingBarcodes: string[];
  unexpectedBarcodes: string[];
}

export interface AuditResult {
  category: string;
  size: string;
  studio: string;
  expectedCount: number;
  foundCount: number;
  missingCount: number;
  missingBarcodes: string[];
  auditedAt: string;
  auditedBy: string;
}

export interface WeeklyAuditItem {
  barcode: string;
  name: string;
  size: string;
  category: string;
  rationale: string;
  expectedLocation: string;
}

export interface WeeklyAuditList {
  weekId: string;
  generatedAt: string;
  items: WeeklyAuditItem[];
  city: string;
  studio: string;
}

export interface GPIssueSummary {
  gpName: string;
  gpBarcode?: string;
  issueCount: number;
  lastIssued?: string;
  items: Record<string, number>;
}

export interface ItemDemandSummary {
  itemName: string;
  size: string;
  category: string;
  totalIssued: number;
  avgPerWeek: number;
  suggestedStock: number;
}

export interface ItemLifespanSummary {
  category: string;
  avgLifespanDays: number;
  medianLifespanDays?: number;
  sampleSize: number;
  minLifespanDays?: number;
  maxLifespanDays?: number;
}

export interface CSVImportRow {
  name: string;
  size: string;
  barcode: string;
  status: string;
  category: string;
  studioLocation: string;
}

export interface CSVGPImportRow {
  gpName: string;
  gpIdCard: string;
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

export interface CSVSkippedRow {
  rowNumber: number;
  data: string;
  reason: string;
}
