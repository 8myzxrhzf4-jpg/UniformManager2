# Uniform Manager Web App

A minimal web application for casino uniform inventory management using React, Vite, TypeScript, and Firebase Realtime Database.

## Features

- **Authentication**: Email/Password and Google Sign-in
- **Real-time Data**: Connects to Firebase Realtime Database
- **City/Studio Selection**: Browse inventory by location
- **Inventory View**: Read-only view of uniform items with details (name, size, barcode, status, studio location)
- **Activity Logs**: View last 100 log entries for selected city/studio (most recent first)
- **Clean Listener Lifecycle**: Proper subscription cleanup on unmount and selection changes

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

The web app currently reads from these Firebase Realtime Database paths:

- `/cities` - City and studio definitions
- `/inventory/{city}` - Uniform items per city
- `/logs/{city}/{studio}` - Activity logs per city/studio (limited to last 100)

> **Note**: The data model also includes `/gps`, `/assignments/{city}`, and `/laundry_orders/{city}` paths, but these are not currently displayed in the web dashboard. They are actively used by the Android mobile app.

### Sample Data Structure

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
  "logs": {
    "city1": {
      "studio1": {
        "log1": {
          "date": "2026-02-12T10:30:00Z",
          "action": "ISSUE",
          "details": "Issued White Shirt (SHIRT001) to John Doe"
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
│   │   ├── Auth.tsx          # Authentication component
│   │   ├── Auth.css
│   │   ├── Dashboard.tsx     # Main dashboard with inventory and logs
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

## Notes

- This is a **read-only** web app for viewing inventory and logs
- Write operations should be implemented based on your access control requirements
- The mobile app (Android) uses the same Firebase schema
- Logs are limited to the last 100 entries to optimize performance
- All Firebase listeners properly clean up on component unmount and when selections change

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
