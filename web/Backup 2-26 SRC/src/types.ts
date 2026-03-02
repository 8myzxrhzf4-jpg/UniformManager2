// Data models aligned with Firebase Realtime Database schema

// Valid uniform status values
export type UniformStatus = 
  | 'Available'      // Available for issue (same as "In Stock")
  | 'In Stock'       // Available for issue (legacy, treated as "Available")
  | 'Issued'         // Issued to a game presenter
  | 'In Hamper'      // Returned to hamper at studio, awaiting laundry pickup
  | 'At Laundry'     // Picked up by laundry service
  | 'Damaged'        // Damaged and out of service
  | 'Lost';          // Lost and out of service

// Valid role types
export type UserRole = 'Super User' | 'Admin' | 'Staff' | 'Auditor';

// Account approval status
export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface Studio {
  name: string;
  hamperCapacity: number;
  currentHamperCount: number;
}

export interface City {
  name: string;
  studios: Record<string, Studio>;
  laundryEnabled?: boolean; // If false, returned items go directly back to Available
}

export interface UniformItem {
  name: string;
  size: string;
  barcode: string;
  status: UniformStatus | string; // Allow string for backward compatibility
  category: string;
  studioLocation: string;
  // Issue tracking
  issuedAtStudio?: string;
  issuedAtCity?: string;
  issuedBy?: string;
  issuedAt?: string;
  // Return tracking
  returnedAtStudio?: string;
  returnedBy?: string;
  returnedAt?: string;
}

export interface LogEntry {
  date: string;
  action: string;
  details: string;
}

// Game Presenter (GP) interface
export interface GamePresenter {
  name: string;
  barcode?: string;  // GP ID card
  city?: string;
  studio?: string;
}

// User authentication and roles
export interface User {
  uid: string;
  email: string;
  role: UserRole;
  city?: string;      // For non-Super users, their assigned city
  studios?: string[]; // For non-Super users, their assigned studios
}

// Pending/approved user record stored in Firebase
export interface UserRecord {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  status: AccountStatus;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  assignedCities?: string[]; // City keys the user can access
}

// Assignment tracking
export interface Assignment {
  itemBarcode: string;
  itemName: string;
  itemSize: string;
  gpName: string;
  gpBarcode?: string;
  // Issue tracking
  issuedAt: string;
  issuedAtStudio: string;
  issuedAtCity: string;
  issuedBy?: string;
  // Return tracking
  returnedAt?: string;
  returnedAtStudio?: string;
  returnedBy?: string;
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

// Smart Audit: Audit session for scanning and comparing
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
  expectedBarcodes: string[]; // Expected items (Available only, excluding laundry states)
  scannedBarcodes: string[];  // Actually found items
  missingBarcodes: string[];  // Expected but not found
  unexpectedBarcodes: string[]; // Found but not expected
}

// Smart Audit: Audit result for CSV export
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
