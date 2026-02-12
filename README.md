# UniformManager2

UniformManager2 is a Spring Boot + Android (Jetpack Compose) project for tracking casino uniform inventory, issuing/returning items, managing laundry hampers, and auditing activity.

## Features
- **Inventory management**: Track uniforms by name, size, barcode, status, category, and studio location.
- **Issuing & returning**: Issue uniforms to game presenters; return to hampers with soft capacity warnings.
- **Laundry management**: Create laundry orders, mark items to hampers, and track pickups/dropoffs.
- **Studios & cities**: Manage studios per city with hamper capacities.
- **Audit logging**: Record actions (issue, return, transfers) for traceability.
- **Roles & users**: Admin/staff/auditor roles (seeded users in migrations; security wiring pending PR).
- **Soft hamper limits with warnings**: Counts can exceed capacity; warnings prompt pickups.
- **CSV Import/Export**: Bulk data operations for inventory and game presenters via Android app.
  - Import/export inventory items (with city/studio filtering)
  - Import/export game presenters
  - Export issued items, master logs, and audit reports
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
5. **Status flow** (canonical): `In Stock → Issued → In Laundry → In Stock`; `Damaged/Lost` terminal. If client sends “In Hamper,” map to “In Laundry”.
6. **Hamper counts**: Soft limit; operations continue when capacity is exceeded, but warnings should be surfaced. Ensure pickups call decrement.

## Quick Start (Android app)
1. **Setup Firebase**: Follow instructions in `FIREBASE_SETUP.md` to configure Firebase Realtime Database.
2. Open the project in Android Studio (Giraffe+), let it sync Gradle.
3. Run on device/emulator with camera for barcode scanning.
4. Select city/studio, scan presenter barcode to set staff, then scan uniform items to issue/return.
5. Laundry screen shows hamper utilization; "full" triggers warning but not a block.
6. **CSV Operations**: Use the Import/Export buttons on the main screen for bulk data management:
   - **IMP INV** / **EXP INV**: Import/export uniform inventory
   - **IMP GP**: Import game presenters
   - **EXP ISSUED**: Export issued items
   - **EXP LOGS**: Export master activity log
   - **Audit Report**: Export audit findings

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
