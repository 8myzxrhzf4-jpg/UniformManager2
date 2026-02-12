# Firebase Setup for UniformManager2

## Current Status
The app has been migrated to use Firebase Realtime Database for data persistence and synchronization.

## Configuration Required

### 1. Google Services JSON
A template `google-services.json` file is included in `app/google-services.json`. **This is a DEMO file and must be replaced with your actual Firebase project configuration.**

To set up Firebase:
1. Create a Firebase project at https://console.firebase.google.com
2. Add an Android app with package name: `com.casino.uniforms`
3. Download the `google-services.json` file
4. Replace `app/google-services.json` with your downloaded file

### 2. Firebase Realtime Database
1. In your Firebase console, go to Realtime Database
2. Create a database in your preferred region
3. Start in **test mode** for development (configure rules for production)

### 3. Database Structure
The app uses this structure:
```
/
├── cities/
│   └── {cityName}/
│       ├── studios/
│       │   └── {studioName}/
│       │       ├── hamperCapacity: Int
│       │       └── currentHamperCount: Int
│       ├── inventory/
│       ├── assignments/
│       ├── laundry_orders/
│       └── logs/
└── game_presenters/
```

### 4. Offline Support
The app maintains local caching in SharedPreferences, so it will work offline and sync when connectivity is restored.

## Key Features Implemented
- ✅ Firebase Realtime Database integration
- ✅ DisposableEffect lifecycle management for listeners
- ✅ Canonical status normalization ("In Stock", "Issued", "In Laundry")
- ✅ Firebase transactions for hamper count updates (race condition safe)
- ✅ Assignment push keys for reliable deletion
- ✅ Error handling with user feedback (Toast messages)
- ✅ CSV import duplicate detection and reporting
- ✅ City admin full save/delete support
- ✅ Camera ANR fixes (background executor for image analysis)

## Building
Note: AGP 9.0.0 is specified in the build files but may not be available yet. If you encounter build issues, downgrade to AGP 8.x in `build.gradle.kts` and `gradle/libs.versions.toml`.
