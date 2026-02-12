# CSV Import/Export Feature Documentation

## Overview
This document describes the CSV import/export feature implemented in the UniformManager2 Android app.

## Important Notes

### CSV Format Limitations
The current implementation uses a simple comma-separated parsing approach. For best results:
- **Avoid commas** in field values (e.g., use "John Smith" not "Smith, John")
- If commas are required in data, consider using semicolons or other delimiters
- Fields are not quote-aware during import (though export quotes fields)
- Future enhancement: Consider implementing RFC 4180 compliant CSV parsing library

### Field Value Restrictions
- **Barcode/ID card**: Should not contain commas
- **Names**: Avoid commas (use "FirstName LastName" format)
- **Status/City/Studio**: Use simple text without special characters

## UI Flow

### Main Dashboard
The main dashboard has been updated to include a dedicated "IMPORT / EXPORT" button that takes users to a new screen for managing CSV operations.

**Changes to Main Dashboard:**
- Replaced the 3-column grid of import/export buttons with:
  - Single prominent "IMPORT / EXPORT" button (blue background with gold text)
  - Row with "VIEW HISTORY" and "EXPORT LOGS" buttons

### Import/Export Screen

When users tap the "IMPORT / EXPORT" button, they are taken to a dedicated screen with the following components:

#### 1. Header
- Back button (arrow) to return to main dashboard
- Title: "Import / Export"

#### 2. Import Type Dropdown
- Dropdown button showing current selection: "Import Type: [Inventory/Game Presenters (GPs)]"
- Tapping opens a menu with two options:
  - Inventory
  - Game Presenters (GPs)

#### 3. Help Card
Displays context-sensitive requirements based on selected import type:

**For Inventory:**
```
Inventory Import Requirements

Required columns (case-insensitive):
• ITEM - uniform item name
• SIZE - item size
• BARCODE - unique identifier
• STATUS - item status (default: In Stock)
• City - city name (optional)
• Studio - studio location (default: current studio)

Duplicates (by barcode) will be skipped.
```

**For Game Presenters:**
```
Game Presenter Import Requirements

Required columns (case-insensitive):
• Dealer - presenter name
• ID card - unique identifier

Duplicates (by ID card) will be skipped.
```

#### 4. Import Section
- Label: "Import"
- Button: "Import Inventory" or "Import Game Presenters" (gold background)
  - Opens file picker to select CSV file
  - Triggers import process with validation

#### 5. Export Section
- Label: "Export"
- For Inventory tab:
  - "Export Inventory" button - exports current inventory
  - "Export Issued Items" button - exports issued items
- For Game Presenters tab:
  - Gray text: "Export for Game Presenters is not available in this version."

#### 6. Preview Section
- Card showing current data counts:
  - For Inventory: "Current Inventory Count: X" and "Studio: [name]"
  - For Game Presenters: "Current Game Presenters: X" and "City: [name]"

## Import Process

### Inventory Import

1. User selects "Inventory" from dropdown
2. User taps "Import Inventory" button
3. File picker opens for user to select CSV file
4. System validates CSV headers (case-insensitive):
   - Required: ITEM, SIZE, BARCODE
   - Optional: STATUS, City, Studio
5. System processes each row:
   - Checks for insufficient columns → skip with reason
   - Checks for empty barcode → skip with reason
   - Checks for empty item name → skip with reason
   - Checks for empty size → skip with reason
   - Checks for duplicate barcode in file → skip with reason
   - Checks for duplicate barcode in existing inventory → skip with reason
   - Valid rows are added to inventory
6. Import completes:
   - Toast message: "Import complete: X added, Y skipped"
   - If skipped rows exist, creates CSV log in Downloads folder: `inventory_import_skipped.csv`

### Game Presenter Import

1. User selects "Game Presenters (GPs)" from dropdown
2. User taps "Import Game Presenters" button
3. File picker opens for user to select CSV file
4. System validates CSV headers (case-insensitive):
   - Required: Dealer, ID card (or "ID card" with space)
5. System processes each row:
   - Checks for insufficient columns → skip with reason
   - Checks for empty ID card → skip with reason
   - Checks for empty dealer name → skip with reason
   - Checks for duplicate ID card in file → skip with reason
   - Checks for duplicate ID card in existing presenters → skip with reason
   - Valid rows are added to presenter list
6. Import completes:
   - Toast message: "Import complete: X added, Y skipped"
   - If skipped rows exist, creates CSV log in Downloads folder: `gp_import_skipped.csv`

## Error Handling

### Validation Errors
- **Empty file**: Toast "Empty file"
- **Missing required columns**: Toast "Missing required columns: [column names]"
- **Import error**: Toast "Import error: [error message]"

### Skipped Rows Log
When rows are skipped during import, a CSV file is created with:
- **Filename**: `inventory_import_skipped.csv` or `gp_import_skipped.csv`
- **Location**: App's Downloads folder
- **Format**:
  ```csv
  Row Number,Data,Reason
  3,"Item,Size,,Status,City,Studio","Empty barcode"
  4,"Duplicate,M,INV001,In Stock,Vegas,Floor","Duplicate barcode in file"
  5,",M,INV002,In Stock,Vegas,Floor","Empty item name"
  ```

### Common Skip Reasons
**Inventory Import:**
- "Insufficient columns" - Row doesn't have enough fields
- "Empty barcode" - Barcode field is missing or empty
- "Empty item name" - ITEM field is missing or empty
- "Empty size" - SIZE field is missing or empty
- "Duplicate barcode in file" - Same barcode appears multiple times in the CSV
- "Barcode already exists in inventory" - Barcode is already in the database

**Game Presenter Import:**
- "Insufficient columns" - Row doesn't have enough fields
- "Empty ID card" - ID card field is missing or empty
- "Empty dealer name" - Dealer field is missing or empty
- "Duplicate ID card in file" - Same ID card appears multiple times in the CSV
- "ID card already exists" - ID card is already in the database

## Export Process

### Inventory Export
Exports all inventory items to CSV with format:
```csv
City: [city], Studio: [studio]
Name,Size,Barcode,Status,Category,Studio Location
[data rows...]
```

### Issued Items Export
Exports all issued items to CSV with format:
```csv
Location: [city] | Studio: [studio]
Staff Name,Item,Size,Barcode,Date Issued,Origin Studio
[data rows...]
```

### Logs Export
Exports audit logs to CSV with format:
```csv
Log Export: [city] | [studio]
Date,Action,Details
[data rows...]
```

## Test Files

Sample CSV files are provided in the `test-data/` directory:

**Valid Files:**
- `TestInventoryUnique.csv` - Valid inventory import with 10 items, no duplicates or errors
- `gp_2-5-26.csv` - Valid game presenter import with 10 presenters, no duplicates or errors

**Error Handling Test Files:**
- `TestInventoryWithErrors.csv` - Demonstrates inventory error handling:
  - Valid items that should import successfully
  - Duplicate barcode (row 4: same barcode as row 2)
  - Empty item name (row 5)
  - Empty size (row 7)
  - Valid items with optional fields empty (status defaults to "In Stock", studio defaults to current)
  
- `TestGPWithErrors.csv` - Demonstrates GP error handling:
  - Valid presenters that should import successfully
  - Duplicate ID card (row 4: same ID card as row 3)
  - Empty dealer name (row 6)
  - Empty ID card (row 8)

## UI Color Scheme

- **Background**: Navy (#050A18)
- **Primary**: Gold (#FFD700)
- **Secondary**: Surface Blue (#161E2E)
- **Cards**: Surface Blue with padding
- **Buttons**: Gold background with Navy text (primary action) or outlined with Gold (secondary action)

## Navigation Flow

```
Main Dashboard
    ↓
[IMPORT / EXPORT] button
    ↓
Import/Export Screen
    ├─ [Dropdown] Select Import Type
    ├─ [Help Card] View Requirements
    ├─ [Import Button] Select and Import CSV
    ├─ [Export Buttons] Export Data
    └─ [Back Button] Return to Dashboard
```
