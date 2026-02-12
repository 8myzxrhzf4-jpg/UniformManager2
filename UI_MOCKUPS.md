# UI Screen Mockups (Text-Based)

## Main Dashboard (Updated)
```
┌─────────────────────────────────────────┐
│  ← UNIFORM PRO                    ☰     │
│     Vegas | Main Floor                  │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │   ISSUE     │  │   RETURN    │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │   AUDIT     │  │   LEVELS    │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  ┌───────────────────────────────┐     │
│  │  ⚠ DAMAGED / LOSS            │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────┐     │
│  │  ⇄ IMPORT / EXPORT (BLUE)    │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌─────────────┐  ┌─────────────┐      │
│  │VIEW HISTORY │  │EXPORT LOGS  │      │
│  └─────────────┘  └─────────────┘      │
│                                         │
│  Search Barcode or Name...             │
│  ┌───────────────────────────────┐     │
│  │ Dealer Jacket | INV001        │     │
│  │ Main Floor          In Stock  │     │
│  ├───────────────────────────────┤     │
│  │ Floor Vest | INV002           │     │
│  │ Main Floor          In Stock  │     │
│  └───────────────────────────────┘     │
│                                         │
│                              [+ ADD GP] │
└─────────────────────────────────────────┘
```

## Import/Export Screen - Inventory Selected
```
┌─────────────────────────────────────────┐
│  ← Import / Export                      │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────┐     │
│  │ Import Type: Inventory     ▼  │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Inventory Import Requirements     │ │
│  │                                   │ │
│  │ Required columns (case-insens...):│ │
│  │ • ITEM - uniform item name       │ │
│  │ • SIZE - item size               │ │
│  │ • BARCODE - unique identifier    │ │
│  │ • STATUS - item status (default: │ │
│  │   In Stock)                      │ │
│  │ • City - city name (optional)    │ │
│  │ • Studio - studio location       │ │
│  │   (default: current studio)      │ │
│  │                                   │ │
│  │ Duplicates (by barcode) will be  │ │
│  │ skipped.                          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Import                                 │
│  ┌───────────────────────────────┐     │
│  │  ↑ Import Inventory (GOLD)    │     │
│  └───────────────────────────────┘     │
│                                         │
│  Export                                 │
│  ┌───────────────────────────────┐     │
│  │  ↓ Export Inventory           │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │  ↓ Export Issued Items        │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Preview                           │ │
│  │                                   │ │
│  │ Current Inventory Count: 150     │ │
│  │ Studio: Main Floor               │ │
│  │                                   │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

## Import/Export Screen - Game Presenters Selected
```
┌─────────────────────────────────────────┐
│  ← Import / Export                      │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────┐     │
│  │ Import Type: Game Presenters  │     │
│  │ (GPs)                      ▼  │     │
│  └───────────────────────────────┘     │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Game Presenter Import             │ │
│  │ Requirements                      │ │
│  │                                   │ │
│  │ Required columns (case-insens...):│ │
│  │ • Dealer - presenter name        │ │
│  │ • ID card - unique identifier    │ │
│  │                                   │ │
│  │ Duplicates (by ID card) will be  │ │
│  │ skipped.                          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Import                                 │
│  ┌───────────────────────────────┐     │
│  │  ↑ Import Game Presenters     │     │
│  │    (GOLD)                     │     │
│  └───────────────────────────────┘     │
│                                         │
│  Export                                 │
│  Export for Game Presenters is not     │
│  available in this version.            │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Preview                           │ │
│  │                                   │ │
│  │ Current Game Presenters: 25      │ │
│  │ City: Vegas                      │ │
│  │                                   │ │
│  │                                   │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

## Dropdown Menu Expanded
```
┌─────────────────────────────────────────┐
│  ← Import / Export                      │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────┐     │
│  │ Import Type: Inventory     ▼  │     │
│  └───────────────────────────────┘     │
│  ┌───────────────────────────────┐     │
│  │ Inventory                ✓    │     │
│  │ Game Presenters (GPs)         │     │
│  └───────────────────────────────┘     │
│                                         │
│  [Rest of screen...]                   │
│                                         │
└─────────────────────────────────────────┘
```

## Import Success Toast
```
┌─────────────────────────────────────┐
│  Import complete: 10 added,         │
│  2 skipped                          │
└─────────────────────────────────────┘
```

## Import Error Toast
```
┌─────────────────────────────────────┐
│  Missing required columns:          │
│  ITEM, SIZE, BARCODE                │
└─────────────────────────────────────┘
```

## Skipped Rows Log Saved Toast
```
┌─────────────────────────────────────┐
│  Skipped rows log saved to          │
│  Downloads/inventory_import_        │
│  skipped.csv                        │
└─────────────────────────────────────┘
```
