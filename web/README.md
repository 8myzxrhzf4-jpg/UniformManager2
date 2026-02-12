# Uniform Manager Web App

A comprehensive web application for casino uniform inventory management using React, Vite, TypeScript, and Firebase Realtime Database.

## Features

### Authentication
- **Email/Password and Google Sign-in**: Secure authentication with Firebase
- **User session management**: Automatic session persistence

### Real-time Data Management
- **Firebase Realtime Database**: Live data synchronization
- **City/Studio Selection**: Hierarchical location browsing
- **Time-bounded reads**: Optimized for Firebase Spark plan (free tier)

### Inventory Management
- **Real-time inventory view**: Browse uniform items with details (name, size, barcode, status, category, studio location)
- **Status tracking**: In Stock, Issued, In Laundry, Damaged, Lost
- **Studio-scoped operations**: All actions limited to selected city/studio
- **Activity logs**: Last 100 log entries per city/studio (most recent first)

### Operations (Studio-Scoped)

#### Issue Uniforms
- Select items with "In Stock" status at current studio
- Assign to existing or new Game Presenter (GP)
- Creates assignment record and updates item status to "Issued"
- Logs all issue actions

#### Return Uniforms
- Scan or search by barcode
- Updates item status to "In Stock"
- Closes active assignment record
- Warns if returning non-issued items

#### Laundry Management
- Create laundry orders from issued items
- Updates item statuses to "In Laundry"
- Increments studio hamper count
- Tracks order number, timestamps, and item count

#### Damage/Lost Tracking
- Mark items as Damaged or Lost
- Creates damage record with optional notes
- Terminal status (no further transitions)
- Logged for audit trail

### Hamper Capacity Management
- **Display**: Current count, capacity, and utilization percentage
- **Edit capacity**: Update per-studio hamper capacity
- **Warnings**: Alert when count exceeds capacity (soft limit)
- **Visual progress bar**: Color-coded capacity indicator
- **Audit trail**: Logs all capacity changes

### Import/Export (Studio-Scoped)

#### CSV Import
- **Client-side parsing**: No server processing required
- **Required columns**: name, size, barcode, status, category, studioLocation
- **Validation**: Checks for required fields and duplicate barcodes
- **Preview**: Shows parsed data before import
- **Batch writes**: Uses Firebase update() to avoid throttling
- **Error reporting**: Lists all validation errors with row numbers

#### CSV Export
- **Inventory export**: All uniform items with full details
- **Assignments export**: Issue history with timestamps and GP info
- **Laundry orders export**: Order history with status and timestamps
- **Logs export**: Activity logs with date range filters
- **Studio-scoped**: Exports only data for selected location
- **Date range filters**: Optional date filtering for time-series data

### Analytics (Planned - Coming Soon)

**IMPLEMENTED** - Full analytics and reporting suite:

#### GP Routine Issue Report
- **Date ranges**: Last 7 days, 30 days, or custom date range
- **Sorting**: By issue count or GP name
- **Display**: GP name, barcode, issue count, last issued date, items breakdown
- **Export**: CSV download with full GP issue history

#### Items Needed by Size (Weekly Demand)
- **Lookback period**: Configurable (1-52 weeks, default 4 weeks)
- **Safety factor**: Adjustable multiplier for stock suggestions (1.0-3.0, default 1.5)
- **Category filtering**: View demand by specific categories
- **Metrics**: Total issued, average per week, suggested stock levels
- **Export**: CSV download with demand analysis

#### Average Item Lifespan by Category
- **Calculation**: Time from first issue to damaged/lost status
- **Statistics**: Average, median, min, max lifespan in days
- **Sample size**: Number of items analyzed per category
- **Export**: CSV download with lifespan statistics

#### Smart Weekly Audit List Generator
- **Smart selection**: Generates 3-6 items per week based on:
  - Past count mismatches (highest priority)
  - High-frequency items (issued often)
  - Random items for comprehensive coverage over time
- **Week tracking**: ISO week format (YYYY-WW)
- **One per week**: Can only generate once per week
- **Rationale**: Each item shows why it was selected
- **Persistence**: Stores audit lists and history in Firebase
- **Export**: CSV download of current week's audit list

All analytics are:
- **Studio-scoped**: Limited to selected city/studio
- **Time-bounded**: Optimized for Firebase Spark plan
- **Exportable**: CSV downloads for all reports
- **Real-time**: Based on live Firebase data

## Prerequisites

- Node.js 18+ and npm
- Firebase project with Realtime Database enabled
- Firebase Authentication enabled (Email/Password and Google providers)

## Setup

### 1. Clone and Install

```bash
cd web
npm install
```

### 2. Firebase Configuration

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one

#### Enable Firebase Authentication
1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** provider
3. Enable **Google** provider
4. Save changes

#### Setup Realtime Database
1. In Firebase Console, go to **Realtime Database**
2. Create a database (choose location)
3. Start in **test mode** or use the sample rules below
4. Copy your database URL (e.g., `https://your-project-id-default-rtdb.firebaseio.com`)

#### Get Firebase Configuration
1. Go to **Project Settings** > **General**
2. Scroll to **Your apps** section
3. Click **Web app** icon to add a web app (if not already added)
4. Copy the configuration values

### 3. Environment Variables

Create a `.env` file in the `web/` directory:

```bash
cp .env.example .env
```

Edit `.env` and fill in your Firebase configuration:

```env
VITE_FB_API_KEY=your-api-key-here
VITE_FB_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FB_DB_URL=https://your-project-id-default-rtdb.firebaseio.com
VITE_FB_PROJECT_ID=your-project-id
VITE_FB_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FB_SENDER_ID=your-messaging-sender-id
VITE_FB_APP_ID=your-app-id
```

> **Important**: The `databaseURL` can be found on the Realtime Database page in Firebase Console.

### 4. Firebase Realtime Database Rules (Sample)

For development, you can use these rules that allow authenticated reads/writes:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "cities": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "gps": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "inventory": {
      "$cityKey": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "assignments": {
      "$cityKey": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "laundry_orders": {
      "$cityKey": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "logs": {
      "$cityKey": {
        "$studioKey": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

> **Production Note**: Tighten these rules for production. Consider role-based access, write restrictions, and validation rules.

## Running the App

### Development Mode

```bash
npm run dev
```

This starts the Vite dev server at `http://localhost:5173` (or another port if 5173 is busy).

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

This serves the production build locally for testing.

## Data Model

The web app reads from and writes to these Firebase Realtime Database paths:

### Core Data Paths
- `/cities/{cityKey}` - City and studio definitions
  - `studios/{studioKey}` - Studio info including `name`, `hamperCapacity`, `currentHamperCount`
- `/inventory/{cityKey}/{itemKey}` - Uniform items per city
- `/gps/{gpKey}` - Game Presenters (staff who receive uniforms)

### Operational Data Paths
- `/assignments/{cityKey}/{assignmentKey}` - Assignment tracking (issue/return history)
- `/laundry_orders/{cityKey}/{orderKey}` - Laundry order batches
- `/damages/{cityKey}/{damageKey}` - Damage/loss records
- `/logs/{cityKey}/{studioKey}/{logKey}` - Activity logs per city/studio (limited to last 100)

### Analytics Data Paths (Future)
- `/audit_lists/{cityKey}/{studioKey}/{weekId}` - Weekly audit lists
- `/audit_history/{cityKey}/{studioKey}/{auditKey}` - Audit history entries

**IMPLEMENTED** - These paths are now actively used by the Analytics feature.

## CSV Import Format

CSV files for import must include these columns (case-insensitive):

```csv
name,size,barcode,status,category,studioLocation
White Shirt,M,SHIRT001,In Stock,Shirts,studio1
Black Pants,L,PANTS002,In Stock,Pants,studio1
```

### Required Columns
- `name` - Item name (required)
- `size` - Size (required)
- `barcode` - Unique barcode (required, must not exist in inventory)
- `status` - Status (defaults to "In Stock" if not provided)
- `category` - Category (defaults to "Other" if not provided)
- `studioLocation` - Studio key (defaults to current studio if not provided)

### Import Behavior
- Validates all required fields before import
- Checks for duplicate barcodes against existing inventory
- Previews parsed data with error reporting
- Batch writes using Firebase `update()` to minimize API calls
- Logs import action to studio logs

## CSV Export Formats

### Inventory Export
```csv
Name,Size,Barcode,Status,Category,Studio Location
White Shirt,M,SHIRT001,In Stock,Shirts,studio1
```

### Assignments Export
```csv
Item Name,Item Size,Item Barcode,GP Name,Issued At,Returned At,Status,City,Studio
White Shirt,M,SHIRT001,John Doe,2026-02-12T10:00:00Z,2026-02-12T18:00:00Z,returned,Las Vegas,Main Floor
```

### Laundry Orders Export
```csv
Order Number,Item Count,Created At,Picked Up At,Returned At,Status,City,Studio
LO-1707736800000,5,2026-02-12T10:00:00Z,,,pending,Las Vegas,Main Floor
```

### Logs Export
```csv
Date,Action,Details
2026-02-12T10:00:00Z,ISSUE,Issued 3 item(s) to John Doe: White Shirt; Black Pants; Vest
```

### Analytics Exports

#### GP Issue Report Export
```csv
GP Name,GP Barcode,Issue Count,Last Issued,Items
John Doe,GP001,15,2026-02-12T10:00:00Z,White Shirt(5); Black Pants(4); Vest(6)
```

#### Demand Analysis Export
```csv
Item Name,Size,Category,Total Issued,Avg Per Week,Suggested Stock
White Shirt,M,Shirts,24,6.00,9
Black Pants,L,Pants,18,4.50,7
```

#### Lifespan Analysis Export
```csv
Category,Avg Lifespan (Days),Median Lifespan (Days),Min,Max,Sample Size
Shirts,120,115,45,210,24
Pants,150,145,60,250,18
```

#### Audit List Export
```csv
Barcode,Name,Size,Category,Rationale,Expected Location
SHIRT001,White Shirt,M,Shirts,Previously had count mismatch,Main Floor
PANTS002,Black Pants,L,Pants,High issue frequency,Main Floor
VEST003,Vest,XL,Vests,Random selection for coverage,Main Floor
```

## Firebase Spark Plan Optimization

This app is designed to work within Firebase Spark (free tier) limitations:

- **Time-bounded reads**: Logs limited to last 100 entries per studio
- **Assignments**: Limited to last 500 per city
- **Laundry orders**: Limited to last 200 per city
- **Audit lists**: Limited to last 10 weeks per studio
- **Audit history**: Limited to last 200 entries per studio
- **Client-side operations**: No Cloud Functions required
- **Batch updates**: Uses Firebase `update()` for efficient writes
- **Studio scoping**: All operations and analytics scoped to individual studios, not city-wide

## Constraints & Design Decisions

### Smart Weekly Audit Algorithm

The smart audit list generator uses a scoring system to select 3-6 items per week:

1. **Priority Scoring**:
   - Items with past count mismatches: +100 points (highest priority)
   - High-frequency items (issued often): +frequency count
   - Random variance: +0-10 points for variety

2. **Selection Strategy**:
   - Top 60% of items: High-priority items (frequent or with mismatches)
   - Remaining 40%: Random selection for comprehensive coverage
   - Total: 3-6 items depending on inventory size

3. **Coverage Over Time**:
   - Random selection ensures all items are eventually audited
   - Mix of frequent and infrequent items balances accuracy and coverage
   - Mismatch tracking improves future selections

4. **Constraints**:
   - Only In Stock items at selected studio
   - One audit list per week (prevents re-generation)
   - Week ID format: YYYY-WW (ISO week number)

### Client-Side Only
- No Cloud Functions (Spark plan limitation)
- All business logic runs in browser
- CSV parsing and validation in-browser
- Batch operations use Firebase SDK directly

### Studio-Level Scoping
- All operations scoped to selected city/studio
- No city-wide aggregations (reduces read costs)
- Analytics generated per studio
- Audit lists specific to each studio

### Android App Compatibility
- Shares same Firebase schema
- CSV flows separate (web doesn't interfere with mobile)
- Status vocabulary aligned ("In Hamper" maps to "In Laundry")

## Firebase Realtime Database Rules (Sample)

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "cities": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "gps": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "inventory": {
      "$cityKey": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "assignments": {
      "$cityKey": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "laundry_orders": {
      "$cityKey": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "damages": {
      "$cityKey": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    },
    "audit_lists": {
      "$cityKey": {
        "$studioKey": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    },
    "audit_history": {
      "$cityKey": {
        "$studioKey": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    },
    "logs": {
      "$cityKey": {
        "$studioKey": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

> **Production Note**: Tighten these rules for production. Consider role-based access, write restrictions, and validation rules.

## Running the App

### Development Mode

```bash
npm run dev
```

This starts the Vite dev server at `http://localhost:5173` (or another port if 5173 is busy).

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

This serves the production build locally for testing.

## Sample Data Structure

```json
{
  "cities": {
    "city1": {
      "name": "Las Vegas",
      "studios": {
        "studio1": {
          "name": "Main Floor",
          "hamperCapacity": 50,
          "currentHamperCount": 12
        }
      }
    }
  },
  "gps": {
    "gp1": {
      "name": "John Doe",
      "city": "Las Vegas",
      "studio": "Main Floor"
    }
  },
  "inventory": {
    "city1": {
      "item1": {
        "name": "White Shirt",
        "size": "M",
        "barcode": "SHIRT001",
        "status": "In Stock",
        "category": "Shirts",
        "studioLocation": "studio1"
      }
    }
  },
  "assignments": {
    "city1": {
      "assignment1": {
        "itemBarcode": "SHIRT001",
        "itemName": "White Shirt",
        "itemSize": "M",
        "gpName": "John Doe",
        "issuedAt": "2026-02-12T10:00:00Z",
        "status": "active",
        "city": "Las Vegas",
        "studio": "Main Floor"
      }
    }
  },
  "laundry_orders": {
    "city1": {
      "order1": {
        "orderNumber": "LO-1707736800000",
        "items": ["SHIRT001", "PANTS002"],
        "createdAt": "2026-02-12T10:00:00Z",
        "status": "pending",
        "city": "Las Vegas",
        "studio": "Main Floor",
        "itemCount": 2
      }
    }
  },
  "logs": {
    "city1": {
      "studio1": {
        "log1": {
          "date": "2026-02-12T10:30:00Z",
          "action": "ISSUE",
          "details": "Issued 2 item(s) to John Doe: White Shirt, Black Pants"
        }
      }
    }
  }
}
```

## Project Structure

```
web/
├── src/
│   ├── components/
│   │   ├── Auth.tsx               # Authentication component
│   │   ├── Auth.css
│   │   ├── Dashboard.tsx          # Main dashboard with tabs
│   │   ├── Dashboard.css
│   │   ├── Operations.tsx         # Issue/Return/Laundry/Damage operations
│   │   ├── Operations.css
│   │   ├── ImportExport.tsx       # CSV import/export
│   │   ├── ImportExport.css
│   │   ├── HamperManagement.tsx   # Hamper capacity management
│   │   └── HamperManagement.css
│   ├── firebaseClient.ts          # Firebase initialization and exports
│   ├── hooks.ts                   # Custom React hooks for Firebase data
│   ├── types.ts                   # TypeScript interfaces
│   ├── theme.css                  # Dark/gold theme variables and styles
│   ├── App.tsx                    # Root component with auth state
│   ├── App.css
│   ├── index.css
│   └── main.tsx                   # Entry point
│   │   └── Dashboard.css
│   ├── firebaseClient.ts     # Firebase initialization and exports
│   ├── hooks.ts              # Custom React hooks for Firebase data
│   ├── types.ts              # TypeScript interfaces
│   ├── App.tsx               # Root component with auth state
│   ├── App.css
│   ├── index.css
│   └── main.tsx              # Entry point
├── .env.example              # Environment variable template
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 8** - Build tool and dev server
- **Firebase 12** - Backend services
  - Authentication (Email/Password, Google)
  - Realtime Database

## Notes & Best Practices

### Data Management
- **Studio-scoped operations**: All write operations are limited to the selected city/studio
- **Time-bounded reads**: Logs, assignments, and other time-series data use Firebase queries with limits
- **Spark plan optimized**: Designed to work within Firebase free tier constraints
- **Client-side only**: All business logic runs in browser, no Cloud Functions required

### Security
- **Authentication required**: All database paths require authenticated users
- **Production rules**: Tighten Firebase rules for production with role-based access and validation
- **Input validation**: CSV imports validate all required fields and check for duplicates
- **Audit trail**: All operations logged to studio-specific logs path

### Compatibility
- **Android app**: Shares same Firebase schema with mobile app
- **Status vocabulary**: Web app aligns with Android statuses (In Stock, Issued, In Laundry, Damaged, Lost)
- **CSV separation**: Web import/export doesn't interfere with Android CSV flows

### Performance
- **Batch operations**: Uses Firebase `update()` for efficient multi-path writes
- **Limited queries**: All time-series data queries use `limitToLast()` to reduce reads
- **Proper cleanup**: All Firebase listeners properly clean up on component unmount
- **Real-time updates**: Changes sync immediately across all connected clients

### Theme
- **Dark/Gold theme**: Matches Android app design
- **Responsive layout**: Works on desktop and tablet screens
- **Accessible**: High contrast colors for readability

## Troubleshooting

### Authentication Issues
- Ensure Email/Password and Google providers are enabled in Firebase Console
- Check that `.env` file has correct Firebase configuration
- Verify `authDomain` matches your Firebase project

### Database Connection Issues
- Verify `databaseURL` in `.env` is correct (should end with `.firebaseio.com`)
- Check Realtime Database rules allow authenticated reads
- Ensure database is created in Firebase Console

### No Data Showing
- Check that data exists in Firebase Realtime Database
- Verify the data structure matches the expected schema
- Ensure you're signed in with an authenticated user
- Check browser console for errors

## License

Part of UniformManager2 project.
