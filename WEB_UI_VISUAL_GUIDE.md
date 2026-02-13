# Web UI Visual Guide - Import Feature

## Before vs After

### BEFORE (Legacy Implementation)
```
Import CSV
────────────────────────────────────────
CSV must include columns: name, size, barcode, status, category, studioLocation

[Select CSV File]

[Preview showing: Name, Size, Barcode, Status, Category, Studio]

[Import X Items]
```

**Issues:**
- ❌ No import type selector
- ❌ Required legacy columns (name, category, studioLocation)
- ❌ No GP import capability
- ❌ No duplicate handling with logs
- ❌ No detailed skip reporting

---

### AFTER (Current Implementation)

```
Import from CSV
────────────────────────────────────────

Import Type: [Inventory ▼]  [Game Presenters (GPs)]

┌─────────────────────────────────────────────────────────┐
│ Inventory Import Requirements                          │
│                                                         │
│ Required columns (case-insensitive):                   │
│ • ITEM - uniform item name                             │
│ • SIZE - item size                                     │
│ • BARCODE - unique identifier                          │
│ • STATUS - item status (optional, default: "In Stock")│
│ • City - city name (optional)                          │
│ • Studio - studio location (optional, default: Main)  │
│                                                         │
│ Duplicates (by barcode) will be skipped.              │
└─────────────────────────────────────────────────────────┘

[Select CSV File]

[SUCCESS] Parsed 10 row(s) successfully

┌─────────────────────────────────────────────────────────┐
│ ⚠ Skipped Rows: 3                                      │
│                                                         │
│ • Row 4: Duplicate barcode in file                     │
│ • Row 7: Empty size                                    │
│ • Row 8: Empty barcode                                 │
│                                                         │
│ [Download Skipped Rows CSV]                            │
└─────────────────────────────────────────────────────────┘

Preview (7 items)
┌──────────────────────────────────────────────────────────┐
│ Name             │ Size │ Barcode │ Status    │ Studio  │
├──────────────────┼──────┼─────────┼───────────┼─────────┤
│ Dealer Jacket    │ M    │ INV001  │ In Stock  │ Main    │
│ Dealer Vest      │ L    │ INV002  │ In Stock  │ Main    │
│ ...              │      │         │           │         │
└──────────────────────────────────────────────────────────┘

[Import 7 Items]
```

**Improvements:**
- ✅ Import type selector dropdown
- ✅ New column format (ITEM instead of name)
- ✅ Context-sensitive help text
- ✅ Duplicate detection and skipping
- ✅ Downloadable CSV log for skipped rows
- ✅ Clear summary counts
- ✅ GP import support

---

## GP Import View

```
Import from CSV
────────────────────────────────────────

Import Type: [Game Presenters (GPs) ▼]

┌─────────────────────────────────────────────────────────┐
│ Game Presenter Import Requirements                     │
│                                                         │
│ Required columns (case-insensitive):                   │
│ • Dealer - presenter name                              │
│ • ID card - unique identifier                          │
│                                                         │
│ Duplicates (by ID card) will be skipped.              │
└─────────────────────────────────────────────────────────┘

[Select CSV File]

[SUCCESS] Parsed 10 row(s) successfully

Preview (10 items)
┌────────────────────────────────────────┐
│ Dealer Name      │ ID Card            │
├──────────────────┼────────────────────┤
│ John Smith       │ GP001              │
│ Mary Johnson     │ GP002              │
│ Robert Williams  │ GP003              │
│ ...              │                    │
└────────────────────────────────────────┘

[Import 10 Game Presenters]
```

---

## Key UI Components

### 1. Import Type Dropdown
```
┌─────────────────────────────┐
│ Import Type:                │
│ ┌─────────────────────────┐ │
│ │ Inventory            ▼ │ │ ← User can click to change
│ └─────────────────────────┘ │
│                             │
│ Options:                    │
│ • Inventory                 │
│ • Game Presenters (GPs)     │
└─────────────────────────────┘
```

### 2. Help Card (Dynamic)
- Background: Dark blue (#1a1f2e)
- Updates automatically when import type changes
- Shows only relevant columns for selected type
- Clear hierarchy with bullet points

### 3. Skipped Rows Alert (Yellow Warning)
```
┌─────────────────────────────────────────┐
│ ⚠ Skipped Rows: 3                      │
│                                         │
│ The following rows were skipped:       │
│ • Row 4: Duplicate barcode in file     │
│ • Row 7: Empty size                    │
│ • Row 8: Empty barcode                 │
│ ... and 0 more                         │
│                                         │
│ [Download Skipped Rows CSV]            │
└─────────────────────────────────────────┘
```

### 4. Preview Tables

**Inventory Preview:**
| Name | Size | Barcode | Status | Category | Studio |
|------|------|---------|--------|----------|--------|
| ... | ... | ... | ... | Other | ... |

**GP Preview:**
| Dealer Name | ID Card |
|-------------|---------|
| ... | ... |

### 5. Import Button (Dynamic Label)
- Inventory: "Import X Items"
- GP: "Import X Game Presenters"
- Shows count from preview
- Disabled if no data or errors present

---

## User Interaction Flow

### Inventory Import
1. User sees "Inventory" selected by default
2. Help card shows ITEM, SIZE, BARCODE requirements
3. User clicks "Select CSV File"
4. File dialog opens
5. User selects TestInventoryUnique.csv
6. System validates headers (case-insensitive)
7. System parses data
8. Preview shows 10 items with defaults applied
9. If duplicates found, yellow alert shows with download button
10. User clicks "Import 10 Items"
11. Progress indicator: "Importing..."
12. Success message: "Successfully imported 10 items. 0 rows skipped"
13. Preview clears, file input resets

### GP Import
1. User clicks Import Type dropdown
2. User selects "Game Presenters (GPs)"
3. Help card updates to show Dealer, ID card requirements
4. Preview table columns change (if data was loaded)
5. User clicks "Select CSV File"
6. User selects gp_2-5-26.csv
7. System validates headers
8. Preview shows Dealer Name and ID Card columns
9. User clicks "Import 10 Game Presenters"
10. Success message appears
11. Data synced to Firebase

---

## Error Messages

### Missing Headers
```
❌ Missing required columns: ITEM, SIZE
Required: ITEM, SIZE, BARCODE
```

### No Data
```
❌ No data to import
```

### Import Failure
```
❌ Failed to import. Please try again.
```

---

## Color Scheme

### Alert Types
- **Info (Blue)**: `alert-info` - Successful parse messages
- **Success (Green)**: `alert-success` - Successful import
- **Warning (Yellow)**: `alert-warning` - Skipped rows alert
- **Error (Red)**: `alert-error` - Validation errors

### Buttons
- **Primary (Gold)**: Import buttons, file selection
- **Secondary**: Download skipped rows CSV

### Text
- **Primary**: Regular text (white/light gray)
- **Muted**: Help text, descriptions (gray)
- **Accent (Gold)**: Headers, section titles

---

## Responsive Behavior

- Help card adjusts to container width
- Preview table scrollable horizontally if needed
- Shows first 10 rows max in preview
- "Showing first 10 of X rows" message if more data
- Skipped rows alert shows first 5, then "... and X more"

---

## Accessibility

- Proper label associations
- Clear button text
- Semantic HTML structure
- Keyboard navigation support
- Screen reader friendly messages

---

## File Type Support

**Accepted:** `.csv` files only
**Encoding:** UTF-8
**Format:** Simple CSV (comma-separated)
**Limitation:** No commas in field values (use simple text)

---

## Data Flow

```
[User selects file]
        ↓
[FileReader reads text]
        ↓
[parseInventoryCSV() or parseGPCSV()]
        ↓
[Validate headers (case-insensitive)]
        ↓
[Parse each row]
        ↓
[Check duplicates: in-file & DB]
        ↓
[Build preview array]
        ↓
[Build skippedRows array]
        ↓
[Display preview + skipped alert]
        ↓
[User clicks Import]
        ↓
[Write to Firebase: inventory/{cityKey} or gamePresenters/{cityKey}]
        ↓
[Log import action]
        ↓
[Display success message]
        ↓
[Clear preview, reset form]
```

---

## CSV Log File Format

### Inventory: `inventory_import_skipped.csv`
```csv
Row Number,Data,Reason
4,"Duplicate Item,M,INV001,In Stock,Vegas,Floor","Duplicate barcode in file"
7,"Empty Size,,TEST005,In Stock,Vegas,Floor","Empty size"
8,"Missing Barcode,XL,,In Stock,Vegas,Floor","Empty barcode"
```

### GP: `gp_import_skipped.csv`
```csv
Row Number,Data,Reason
4,"Duplicate Name,ID001","Duplicate ID card in file"
6,",ID004","Empty dealer name"
8,"Missing ID,","Empty ID card"
```

---

## Integration Points

### Firebase Paths
- Inventory: `/inventory/{cityKey}/{itemKey}`
- GP: `/gamePresenters/{cityKey}/{gpKey}`
- Logs: `/logs/{cityKey}/{studioKey}/{logKey}`

### Data Structures
```typescript
// Inventory item
{
  name: string,
  size: string,
  barcode: string,
  status: string,
  category: string,
  studioLocation: string
}

// Game Presenter
{
  name: string,
  barcode: string, // ID card
  city: string
}
```

---

This completes the visual guide for the new import feature implementation.
