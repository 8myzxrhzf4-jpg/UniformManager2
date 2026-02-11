# Copilot Instructions for UniformManager2

## Overview
UniformManager2 is a dual-platform application for casino uniform inventory management:
- **Backend**: Spring Boot 3 REST API with JPA/PostgreSQL
- **Android**: Jetpack Compose mobile app with barcode scanning

## Tech Stack

### Backend
- **Framework**: Spring Boot 3.x
- **Language**: Kotlin (preferred for new code) and Java (legacy entities)
- **Database**: PostgreSQL (production), H2 (development/testing)
- **ORM**: Spring Data JPA with Flyway migrations
- **Build Tools**: Gradle (primary) and Maven (pom.xml available)
- **Java Version**: JDK 17+

### Android
- **UI Framework**: Jetpack Compose with Material 3
- **Language**: Kotlin
- **Build**: Gradle with Kotlin DSL
- **Min SDK**: 24, Target SDK: 34, Compile SDK: 34
- **Key Libraries**: CameraX, ML Kit Barcode Scanning, Gson
- **Persistence**: SharedPreferences with Gson for offline-first behavior

## Coding Standards

### Backend

#### Entity Classes
- Import `jakarta.persistence.*` for Spring Boot 3 (not `javax.persistence.*`)
- Use `@Entity`, `@Table`, `@Id`, `@GeneratedValue` annotations
- Implement standard getters/setters for Java entities
- Use Kotlin data classes for DTOs when appropriate

#### Data Validation
- Use `@Valid` on DTOs for required fields
- Enforce validation for: barcode (unique), name, status, category
- Return HTTP 409 Conflict for barcode uniqueness violations
- Use database unique constraints as a safety net

#### Status Flow (Canonical)
The uniform status follows this flow:
```
In Stock → Issued → In Laundry → In Stock
                  ↓
            Damaged/Lost (terminal states)
```
- If client sends "In Hamper", map it to "In Laundry"
- Status transitions should be validated in service layer

#### Repository Patterns
- Use Spring Data JPA repository interfaces
- Include custom queries for barcode lookups and studio filters
- Example: `findByBarcode(String barcode)`, `findByStudioId(Long studioId)`

#### Service Layer
- Place business logic in service classes, not controllers
- Handle hamper capacity with soft limits (operations continue when exceeded)
- Surface warnings for capacity breaches but don't block operations
- Ensure laundry pickups decrement hamper counts

### Android

#### Compose UI
- Use Material 3 components
- Follow declarative UI patterns with `@Composable` functions
- Use `remember` and state hoisting appropriately
- Implement `ViewModel` for business logic separation

#### Barcode Scanning
- Use CameraX with ML Kit for barcode detection
- Handle camera permissions properly
- Provide visual feedback during scanning

#### Data Synchronization
- Implement offline-first patterns with SharedPreferences
- Use Gson for serialization/deserialization
- Sync with backend when connectivity is available
- Map local status vocabulary to backend canonical status

## Project Conventions

### Naming
- **Entities**: Singular nouns (e.g., `UniformItem`, not `UniformItems`)
- **Tables**: Plural snake_case (e.g., `uniform_items`, `game_presenters`)
- **DTOs**: Suffix with `Dto` (e.g., `UniformDto`, `AssignmentDto`)
- **Repositories**: Suffix with `Repository` (e.g., `UniformItemRepository`)
- **Services**: Suffix with `Service` (e.g., `InventoryService`)

### Key Business Rules
1. **Barcode Uniqueness**: Each uniform item must have a unique barcode
2. **Soft Hamper Limits**: Hamper capacity is advisory; warn when exceeded but allow operations
3. **Status Validation**: Enforce canonical status values and valid transitions
4. **Audit Logging**: Record all significant actions (issue, return, transfer) for traceability
5. **Role-Based Access**: Implement JWT authentication with ADMIN/STAFF/AUDITOR roles

### Security
- Protect mutating endpoints for STAFF/ADMIN roles
- Audit endpoints restricted to ADMIN/AUDITOR
- Use JWT tokens for authentication
- Users and roles seeded via Flyway migrations
- Never commit secrets or credentials to source code

## Architecture Notes

### Database Schema
Key tables managed by Flyway migrations:
- `cities`, `studios` - Location hierarchy
- `game_presenters` - Staff/users who receive uniforms
- `uniform_items` - Individual uniform inventory
- `assignments` - Issued uniforms tracking
- `laundry_orders` - Batch laundry operations
- `hampers` - Per-studio laundry collection points
- `audit_entries` - Action audit trail
- `users`, `roles`, `user_roles` - Authentication/authorization
- `idempotency_keys` - Duplicate request prevention

### API Design
- RESTful endpoints following Spring conventions
- Use appropriate HTTP methods (GET, POST, PUT, DELETE)
- Return meaningful HTTP status codes
- Include proper error responses with messages

### Testing
- Unit tests in `src/test`
- Use JUnit for backend testing
- Mock external dependencies appropriately
- Test critical business logic (status transitions, capacity checks, barcode uniqueness)

## Build and Run

### Backend
```bash
# Using Gradle (preferred)
./gradlew bootRun
./gradlew test
./gradlew build

# Using Maven (alternative)
mvn spring-boot:run
mvn test
```

### Android
- Open project in Android Studio (Giraffe or later)
- Sync Gradle dependencies
- Run on physical device or emulator
- Camera required for barcode scanning functionality

## Development Workflow

1. **Database Changes**: Create Flyway migration scripts (V6__description.sql, etc.)
2. **Entity Changes**: Update entity classes, then create/update migrations
3. **API Changes**: Update controllers, services, and DTOs; maintain backward compatibility
4. **Status Changes**: Align both backend validation and Android mapping
5. **Testing**: Run relevant tests after changes; avoid breaking existing functionality

## Current Work & Known Issues

### In Progress
- Flyway migration merge (schema initialization)
- Jakarta persistence imports migration (Spring Boot 3 compatibility)
- Security implementation (JWT + role guards)
- Status vocabulary alignment between Android and backend
- Hamper soft-limit handling with warning UI

### Important Notes
- Keep backward compatibility when possible
- Status vocabulary must align: Android "In Hamper" maps to backend "In Laundry"
- Hamper operations should warn but not block when capacity exceeded
- Ensure pickup/dropoff operations properly increment/decrement counts
- Barcode conflicts return 409; unique DB index provides safety net

## Documentation
- Update README.md when adding major features
- Document API endpoints and request/response formats
- Include migration notes for database schema changes
- Comment complex business logic for maintainability
