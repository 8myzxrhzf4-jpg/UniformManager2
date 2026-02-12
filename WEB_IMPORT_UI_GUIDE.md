# Web UI Import Feature Guide

## Overview
This guide describes the enhanced Import/Export feature in the UniformManager2 web UI.

## Access the Feature
1. Navigate to the web dashboard
2. Select a City and Studio from the sidebar
3. Click the "Import/Export" tab in the main content area

## Import Type Selector

### Location
At the top of the Import tab, you'll see a dropdown labeled "Import Type"

### Options
- **Inventory** - For importing uniform items
- **Game Presenters (GPs)** - For importing game presenter records

### Behavior
When you change the import type:
- Help text updates to show relevant required columns
- Preview table columns adjust to match the import type
- File input resets (you'll need to select a new file)
- Any existing preview data is cleared

## Inventory Import

### Step 1: Select Import Type
- Ensure "Inventory" is selected in the Import Type dropdown

### Step 2: Review Requirements
The help card displays:
```
Inventory Import Requirements

Required columns (case-insensitive):
• ITEM - uniform item name
• SIZE - item size
• BARCODE - unique identifier
• STATUS - item status (optional, default: "In Stock")
• City - city name (optional)
• Studio - studio location (optional, default: [current studio])

Duplicates (by barcode) will be skipped.
```

### Step 3: Prepare CSV File
Your CSV file must have these headers (case-insensitive):
- **ITEM** - Required
- **SIZE** - Required
- **BARCODE** - Required
- **STATUS** - Optional (defaults to "In Stock")
- **City** - Optional
- **Studio** - Optional (defaults to current studio)

**Example CSV:**
```csv
ITEM,SIZE,BARCODE,STATUS,City,Studio
Dealer Jacket,M,INV001,In Stock,Las Vegas,Main Floor
Dealer Vest,L,INV002,,Las Vegas,Main Floor
Floor Manager Jacket,XL,INV005,In Stock,Las Vegas,High Limit
```

### Step 4: Select and Upload File
1. Click "Select CSV File" button
2. Choose your CSV file from your computer
3. The system will automatically parse and validate the file

### Step 5: Review Preview
If parsing is successful, you'll see:
- Success message: "Parsed X row(s) successfully"
- Preview table showing first 10 rows with columns:
  - Name
  - Size
  - Barcode
  - Status
  - Category (always "Other")
  - Studio

### Step 6: Handle Errors/Skipped Rows
If any rows have issues, you'll see:
- Yellow warning box showing "Skipped Rows: X"
- List of first 5 skipped rows with reasons
- "Download Skipped Rows CSV" button to get full log

**Common skip reasons:**
- Empty barcode
- Empty item name
- Empty size
- Duplicate barcode in file
- Barcode already exists in inventory

### Step 7: Import Data
1. Click "Import X Items" button
2. Wait for import to complete
3. Success message shows: "Successfully imported X items. Y rows skipped (see downloadable log)"

### Step 8: Download Skipped Rows Log (if needed)
1. Click "Download Skipped Rows CSV" button
2. File `inventory_import_skipped.csv` downloads to your Downloads folder
3. Format: Row Number, Data, Reason

## Game Presenter Import

### Step 1: Select Import Type
- Select "Game Presenters (GPs)" from the Import Type dropdown

### Step 2: Review Requirements
The help card displays:
```
Game Presenter Import Requirements

Required columns (case-insensitive):
• Dealer - presenter name
• ID card - unique identifier

Duplicates (by ID card) will be skipped.
```

### Step 3: Prepare CSV File
Your CSV file must have these headers (case-insensitive):
- **Dealer** - Required
- **ID card** - Required

**Example CSV:**
```csv
Dealer,ID card
John Smith,GP001
Mary Johnson,GP002
Robert Williams,GP003
```

### Step 4: Select and Upload File
1. Click "Select CSV File" button
2. Choose your CSV file from your computer
3. The system will automatically parse and validate the file

### Step 5: Review Preview
If parsing is successful, you'll see:
- Success message: "Parsed X row(s) successfully"
- Preview table showing first 10 rows with columns:
  - Dealer Name
  - ID Card

### Step 6: Handle Errors/Skipped Rows
If any rows have issues, you'll see:
- Yellow warning box showing "Skipped Rows: X"
- List of first 5 skipped rows with reasons
- "Download Skipped Rows CSV" button to get full log

**Common skip reasons:**
- Empty ID card
- Empty dealer name
- Duplicate ID card in file
- ID card already exists

### Step 7: Import Data
1. Click "Import X Game Presenters" button
2. Wait for import to complete
3. Success message shows: "Successfully imported X game presenters. Y rows skipped (see downloadable log)"

### Step 8: Download Skipped Rows Log (if needed)
1. Click "Download Skipped Rows CSV" button
2. File `gp_import_skipped.csv` downloads to your Downloads folder
3. Format: Row Number, Data, Reason

## Error Messages

### Header Validation Errors
- **"Missing required columns: ITEM, SIZE, BARCODE"** - Your CSV is missing one or more required columns. Check that your header row has all required columns (case-insensitive).
- **"Missing required columns: Dealer, ID card"** - For GP import, ensure both Dealer and ID card columns are present.

### File Selection Errors
- **"No data to import"** - The preview is empty. Ensure your file has data rows after the header.

### Import Errors
- **"Failed to import. Please try again."** - A network or database error occurred. Check your connection and try again.

## Test Files

Sample CSV files are provided in the `test-data/` directory:

### Valid Files (No Errors)
- **`TestInventoryUnique.csv`** - 10 unique inventory items
- **`gp_2-5-26.csv`** - 10 unique game presenters

### Test Files (With Errors)
- **`TestInventoryWithErrors.csv`** - Tests error handling:
  - Valid items that import successfully
  - Duplicate barcode (should be skipped)
  - Empty size (should be skipped)
  - Empty barcode (should be skipped)
  
- **`TestGPWithErrors.csv`** - Tests GP error handling:
  - Valid presenters that import successfully
  - Duplicate ID card (should be skipped)
  - Empty dealer name (should be skipped)
  - Empty ID card (should be skipped)

## Tips and Best Practices

1. **Start Small**: Test with a small CSV file first to ensure format is correct
2. **Check Headers**: Column names are case-insensitive but must be spelled correctly
3. **Review Preview**: Always review the preview before clicking Import
4. **Save Skipped Logs**: Download and review skipped row logs to fix data issues
5. **Avoid Commas**: Don't use commas in field values (simple CSV parser)
6. **Unique Identifiers**: Ensure barcodes/ID cards are unique within your file

## Export Feature (Unchanged)

The Export tab remains unchanged:
- Export Inventory
- Export Assignments (with date filtering)
- Export Laundry Orders (with date filtering)
- Export Logs (with date filtering)

All export functionality works as before.
