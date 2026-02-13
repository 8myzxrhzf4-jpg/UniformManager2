# UniformManager2

UniformManager2 is a Spring Boot + Android (Jetpack Compose) project for tracking casino uniform inventory, issuing/returning items, managing laundry hampers, and auditing activity.

## Features
- **Inventory management**: Track uniforms by name, size, barcode, status, category, and studio location.
- **Enhanced Issue & Return Workflows**: 
  - Issue uniforms to game presenters with studio selection dropdown (scoped by city)
  - Prevent duplicate barcodes in issue batches
  - Only issue Available items
  - Track issuedAtStudio, issuedAtCity, issuedBy, GP ID card
  - Return items to any studio's hamper within the city
  - Automatic hamper count updates
  - Preserve issue history when returning
- **Complete Laundry Lifecycle**: 
  - Status flow: Available → Issued → **In Hamper** @ Studio → **At Laundry** → Available
  - Pickup from hamper: In Hamper → At Laundry (decrements hamper count)
  - Receive from laundry: At Laundry → Available (clears issue tracking)
  - Items in laundry states not counted as Available until received
- **Smart Audit System**:
  - Scope audits by Category + Size + Studio
  - Scan/barcode entry interface with real-time feedback
  - Compare expected (Available only) vs found items
  - Exclude items In Hamper or At Laundry from expected set
  - Export detailed CSV with missing barcodes
  - Store audit logs with timestamp and user for traceability
- **Studios & cities**: Manage studios per city with hamper capacities.
- **Audit logging**: Record all actions (issue, return, laundry, audits) for traceability.
- **Roles & users**: Admin/staff/auditor roles (seeded users in migrations; security wiring pending PR).
- **Soft hamper limits with warnings**: Counts can exceed capacity; warnings prompt pickups.
- **Enhanced CSV Import/Export**: Bulk data operations for inventory and game presenters via web dashboard.
  - **Import Type Selector**: Choose between Inventory or Game Presenters import
  - **Inventory Import**: Accepts headers (case-insensitive): ITEM, SIZE, BARCODE, STATUS, City, Studio
    - Required columns: ITEM, SIZE, BARCODE
    - Optional columns: STATUS (validates against: Available, In Stock, Issued, In Hamper, At Laundry, Damaged, Lost)
    - Default status: "Available" (auto-normalizes "In Stock" to "Available")
    - Duplicate detection by barcode (in-file and existing DB)
    - Comprehensive error reporting with downloadable CSV log of skipped rows
  - **Game Presenter Import**: Accepts headers (case-insensitive): Dealer, ID card
    - Both columns required
    - Duplicate detection by ID card (in-file and existing DB)
    - Comprehensive error reporting with downloadable CSV log of skipped rows
  - Export inventory items, issued items, and master logs
  - CSV remains the primary path for bulk data management

## Architecture (brief)
- **Backend**: Spring Boot 3, Spring Data JPA, Flyway migrations (pending merge), services for inventory, assignments, hampers, and laundry. Entities: `UniformItem`, `Studio`, `GamePresenter`, etc. Repositories with barcode/studio queries.
- **Persistence**: PostgreSQL (recommended). Flyway migrations initialize schema (tables for cities, studios, presenters, uniform_items, assignments, laundry_orders, audit_entries, users/roles, idempotency keys, timestamps).
- **Security (in-progress)**: JWT + role-based guards (ADMIN/STAFF/AUDITOR). Users/roles seeded via migrations.
- **Android app**: Jetpack Compose UI with barcode scanning; Firebase Realtime Database for real-time sync; SharedPreferences for offline cache. Supports CSV import/export for bulk operations.
- **Web Dashboard**: Read-only Firebase-based dashboard for viewing inventory and activity logs.

## Quick Start (backend)
1. **Prereqs**: JDK 17+, PostgreSQL, Gradle/Maven wrapper available.
2. **Configure DB**: Set `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`. Ensure Flyway is enabled (default).
3. **Run**: `./gradlew bootRun` (or `mvn spring-boot:run`).
4. **Verify migrations**: `SELECT * FROM flyway_schema_history;` — expect V1–V5.
5. **Status flow** (canonical): `Available → Issued → In Hamper @ Studio X → At Laundry → Available`; `Damaged/Lost` terminal. If client sends “In Hamper,” map to “In Laundry”.
6. **Hamper counts**: Soft limit; operations continue when capacity is exceeded, but warnings should be surfaced. Pickups decrement count, returns increment count.

## Quick Start (Android app)
1. **Setup Firebase**: Follow instructions in `FIREBASE_SETUP.md` to configure Firebase Realtime Database.
2. Open the project in Android Studio (Giraffe+), let it sync Gradle.
3. Run on device/emulator with camera for barcode scanning.
4. Select city/studio, scan presenter barcode to set staff, then scan uniform items to issue/return.
5. Laundry screen shows hamper utilization; "full" triggers warning but not a block.
6. **CSV Operations**: Access the Import/Export screen from the main dashboard:
   - **Import/Export Button**: Opens dedicated Import/Export screen
   - **Import Type Dropdown**: Select "Inventory" or "Game Presenters (GPs)"
   - **Inventory Import**:
     - Required columns (case-insensitive): ITEM, SIZE, BARCODE
     - Optional columns: STATUS (default: "In Stock"), City, Studio (default: current studio)
     - Duplicates (by barcode) are skipped and logged
     - See `test-data/TestInventoryUnique.csv` for sample format
   - **Game Presenter Import**:
     - Required columns (case-insensitive): Dealer, ID card
     - Duplicates (by ID card) are skipped and logged
     - See `test-data/gp_2-5-26.csv` for sample format
   - **Export Options**: Export inventory, issued items, or master activity logs
   - **Error Handling**: Skipped rows are logged to a downloadable CSV file in Downloads folder

## API/Security (planned/ongoing)
- JWT authentication with seeded users (admin/staff/auditor) from migrations.
- Protect mutating endpoints for STAFF/ADMIN; audit endpoints for ADMIN/AUDITOR.
- Include README snippet later with `/auth/login` and Authorization header usage once security PR is merged.

## Development Notes
- Entities should import `jakarta.persistence.*` (Spring Boot 3).
- Keep barcode unique (service should return 409 on conflict; DB unique index as safety net).
- Enforce validation on DTOs (@Valid) for required fields (barcode, name, status, category).

## Roadmap / Open Items
- Merge Flyway migrations (schema) and jakarta imports.
- Merge soft-limit hamper handling with warnings and decrement on pickups.
- Merge status alignment/validation/security PR.
- Align Android status vocabulary with backend.

## CSV Import Format Specifications

### Important Notes
⚠️ **CSV Format Limitations**: The current implementation uses simple comma-separated parsing. To ensure successful imports:
- **Avoid commas** in field values (use "John Smith" not "Smith, John")
- Use simple text without special characters in names and identifiers
- If your data contains commas, consider using alternative formats or cleaning data before import

### Inventory Import
**Required Columns** (case-insensitive):
- `ITEM` - Name of the uniform item (e.g., "Dealer Jacket", "Floor Manager Vest")
- `SIZE` - Size of the item (e.g., "S", "M", "L", "XL")
- `BARCODE` - Unique identifier for the item (e.g., "INV001", "BAR123")

**Optional Columns** (case-insensitive):
- `STATUS` - Current status of the item (default: "Available" if not provided)
  - Valid values: **"Available"** (or "In Stock"), **"Issued"**, **"In Hamper"**, **"At Laundry"**, **"Damaged"**, **"Lost"**
  - Note: "In Stock" is automatically normalized to "Available" during import
- `City` - City location (uses current context if not provided)
- `Studio` - Studio location (default: current studio if not provided)

**Example CSV**:
```csv
ITEM,SIZE,BARCODE,STATUS,City,Studio
Dealer Jacket,M,INV001,In Stock,Las Vegas,Main Floor
Dealer Vest,L,INV002,In Stock,Las Vegas,Main Floor
Floor Manager Jacket,XL,INV005,,Las Vegas,High Limit
```

**Import Behavior**:
- Duplicate barcodes (within the file or existing in database) are skipped
- Skipped rows are logged to a CSV file in the Downloads folder
- Import summary shows counts of added and skipped items
- Empty barcodes result in row being skipped with error message

### Game Presenter Import
**Required Columns** (case-insensitive):
- `Dealer` - Name of the game presenter (e.g., "John Smith", "Mary Johnson")
- `ID card` - Unique identifier for the presenter (e.g., "GP001", "EMP123")

**Example CSV**:
```csv
Dealer,ID card
John Smith,GP001
Mary Johnson,GP002
Robert Williams,GP003
```

**Import Behavior**:
- Duplicate ID cards (within the file or existing in database) are skipped
- Skipped rows are logged to a CSV file in the Downloads folder
- Import summary shows counts of added and skipped presenters
- Empty ID cards result in row being skipped with error message
- Presenters are scoped to the currently selected city

### Test Data
Sample CSV files are available in the `test-data/` directory:
- `TestInventoryUnique.csv` - Valid inventory import with no duplicates
- `gp_2-5-26.csv` - Valid game presenter import with no duplicates
- `TestInventoryWithErrors.csv` - Test file demonstrating error handling
- `TestGPWithErrors.csv` - Test file demonstrating GP error handling

## Recent Changes

### CSV Import Enhancement (2026-02-12)
- Added dedicated Import/Export screen with dropdown to select import type
- Enhanced inventory import to support all required columns (ITEM, SIZE, BARCODE, STATUS, City, Studio)
- Enhanced GP import to support Dealer and ID card columns
- Implemented duplicate detection and skipping for both import types
- Added comprehensive error reporting with downloadable CSV logs
- Updated UI with contextual help text based on selected import type
- Maintained backward compatibility with existing export functionality

### Post-Firebase Migration Cleanup (2026-02-12)
- Removed unused web application hooks and types (useGamePresenters, useAssignments, useLaundryOrders)
- Updated documentation to clarify CSV import/export as primary bulk data path
- Web dashboard remains as read-only Firebase viewer for inventory and logs
- Android app retains all CSV operations: import/export inventory, game presenters, issued items, logs, and audit reports
- Spring Boot backend continues to provide REST API alongside Firebase real-time sync
- All camera/barcode scanning functionality preserved as core app feature

## Web Dashboard Features

The web dashboard provides comprehensive operational tools for managing uniforms:

### Operations Tab
- **Issue Uniforms**:
  - Select target studio from dropdown (scoped by city)
  - Choose game presenter or add new with ID card
  - Select multiple Available items from filtered list
  - Duplicate barcode detection in batch
  - Prevents issuing non-Available items
  - Tracks issuedAtStudio, issuedAtCity, issuedBy, timestamp

- **Return Uniforms**:
  - Select return studio from dropdown (any studio in city)
  - Scan or enter barcode
  - Only accepts Issued items
  - Sets status to "In Hamper" at selected studio
  - Updates hamper count automatically
  - Tracks returnedAtStudio, returnedBy, timestamp
  - Preserves original issuedAtStudio history

- **Laundry Operations**:
  - **Pickup**: Select items In Hamper → send to laundry (At Laundry)
  - **Receive**: Select items At Laundry → return clean (Available)
  - Automatic hamper count adjustments
  - Creates laundry orders with tracking
  - Clears issue/return history when received

- **Damage/Lost**: Mark items with notes and reason

### Import/Export Tab
- **Import Type Selector**: Choose Inventory or Game Presenters
- **Status Validation**: Enforces Available, Issued, In Hamper, At Laundry, Damaged, Lost
- **Duplicate Detection**: Skips duplicates in file and database
- **Error Logging**: Downloadable CSV with skipped rows and reasons
- **Export**: Inventory, assignments, laundry orders, activity logs

### Analytics Tab
- **GP Issue Report**: Track presenter issue frequency
- **Demand Analysis**: Calculate safety stock by size
- **Item Lifespan**: Track time from first issue to damage/loss
- **Weekly Audit List**: Auto-generate smart audit lists
- **Smart Audit Scanner**:
  - Scope by Category + Size + Studio
  - Expected items: Only Available (excludes In Hamper, At Laundry)
  - Real-time scan feedback (expected/unexpected)
  - Compare scanned vs expected
  - Export detailed CSV with missing barcodes
  - Save audit session with timestamp and user

### Hamper Management
- View hamper capacity and current count
- Visual warnings when approaching capacity
- Dropoff and pickup operations
- Reset counts (admin function)

## Status Lifecycle

The complete uniform lifecycle follows this flow:

```
┌─────────────┐
│  Available  │ ←──────────────────────────┐
│ (In Stock)  │                            │
└──────┬──────┘                            │
       │ Issue                             │
       ↓                                   │
┌─────────────┐                            │
│   Issued    │                            │
└──────┬──────┘                            │
       │ Return                            │
       ↓                                   │
┌─────────────┐                            │
│  In Hamper  │ (at selected studio)       │
│ @ Studio X  │                            │
└──────┬──────┘                            │
       │ Laundry Pickup                    │
       ↓                                   │
┌─────────────┐                            │
│ At Laundry  │                            │
└──────┬──────┘                            │
       │ Laundry Receive                   │
       └───────────────────────────────────┘

Terminal states:
┌─────────────┐    ┌─────────────┐
│   Damaged   │    │    Lost     │
└─────────────┘    └─────────────┘
```

**Key Points**:
- **Available/In Stock** are equivalent (In Stock normalized to Available on import)
- **In Hamper** represents items returned but not yet picked up by laundry
- **At Laundry** represents items being cleaned
- Items must complete the full cycle to become Available again
- Hamper count increments on return, decrements on pickup
- Audits only consider Available items as "on hand"


## Import behavior (note)

- Imports are written to Realtime Database under \`inventory/{cityKey}/{itemId}\`.  
  The web UI reads inventory by the currently-selected city key, so ensure you select the intended city before importing.
- \`studioLocation\` is used for per-studio filtering and should match the studio value used in the UI (case-insensitive).
- If you use display names for cities in the UI, ensure a mapping to the DB city key is available (prefer storing and using the DB key in state).

