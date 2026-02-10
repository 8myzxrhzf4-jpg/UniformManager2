# UniformManager2 Backend API

## Overview
This is the backend API for the UniformManager2 application, providing uniform inventory management with status tracking, security, and hamper management.

## Features

### 1. Status Management
The API supports canonical uniform statuses with strict transition rules:

**Canonical Statuses:**
- `In Stock` - Uniform is available in inventory
- `Issued` - Uniform is issued to a presenter
- `In Laundry` - Uniform is in the laundry/hamper
- `Damaged` - Uniform is damaged (terminal state)
- `Lost` - Uniform is lost (terminal state)

**Android App Compatibility:**
- The API accepts `In Hamper` as an alias for `In Laundry`
- When the client sends status "In Hamper", it is automatically mapped to "In Laundry"

**Status Transitions:**
- `In Stock` → `Issued`
- `Issued` → `In Laundry`, `In Stock` (return), `Damaged`, `Lost`
- `In Laundry` → `In Stock`, `Damaged`, `Lost`
- `Damaged` and `Lost` are terminal states (no transitions allowed except by admin restore)

### 2. Validation & Defaults
- **Required Fields:** barcode, name, status, category
- **Validation:** 
  - `@NotBlank` for barcode and name
  - `@NotNull` for status and category
- **Database Defaults:**
  - `status` defaults to "In Stock"
  - `category` defaults to "Other"
  - `barcode`, `status`, and `category` have NOT NULL constraints

### 3. Barcode Uniqueness
- Service-layer check for uniform barcode uniqueness
- Returns HTTP 409 (Conflict) with structured error response
- Database unique index as safety net

### 4. Security
**Authentication:**
- JWT-based authentication
- Login endpoint: `POST /api/auth/login`

**Roles:**
- `ADMIN` - Full access including delete operations
- `STAFF` - Can create, update, issue, return uniforms
- `AUDITOR` - Read-only access (for future audit endpoints)

**Endpoint Protection:**
- Mutating endpoints (POST, PUT, DELETE) require STAFF or ADMIN role
- Delete operations require ADMIN role
- GET operations require authentication

**Default Users (Development):**
- Username: `admin`, Password: `admin123`, Role: ADMIN
- Username: `staff`, Password: `staff123`, Role: STAFF

### 5. Hamper Management
- Soft-limit hamper counts (can exceed capacity with warning)
- Automatic decrement on pickup/dropoff paths
- Utilization tracking through `HamperService`

## API Endpoints

### Authentication
```
POST /api/auth/login
Request: { "username": "admin", "password": "admin123" }
Response: { "token": "jwt-token", "username": "admin", "roles": ["ADMIN"] }
```

### Uniform Management

#### Create Uniform
```
POST /api/uniforms
Headers: Authorization: Bearer <token>
Request: {
  "name": "Blue Shirt",
  "barcode": "SHIRT001",
  "status": "In Stock",  // or "In Hamper" - mapped to "In Laundry"
  "category": "Shirt",
  "size": "M"
}
Response: 201 Created
```

#### Get All Uniforms
```
GET /api/uniforms
Headers: Authorization: Bearer <token>
Response: 200 OK
```

#### Get Uniform by Barcode
```
GET /api/uniforms/{barcode}
Headers: Authorization: Bearer <token>
Response: 200 OK
```

#### Update Uniform
```
PUT /api/uniforms/{barcode}
Headers: Authorization: Bearer <token>
Request: {
  "name": "Updated Name",
  "category": "Updated Category"
}
Response: 200 OK
```

#### Update Status
```
PUT /api/uniforms/{barcode}/status
Headers: Authorization: Bearer <token>
Request: { "status": "Issued" }
Response: 200 OK
```

#### Issue Uniform
```
POST /api/uniforms/{barcode}/issue
Headers: Authorization: Bearer <token>
Response: 200 OK
```

#### Return Uniform
```
POST /api/uniforms/{barcode}/return
Headers: Authorization: Bearer <token>
Response: 200 OK
```

#### Send to Laundry
```
POST /api/uniforms/{barcode}/laundry
Headers: Authorization: Bearer <token>
Response: 200 OK
```

#### Pickup from Laundry
```
POST /api/uniforms/{barcode}/pickup
Headers: Authorization: Bearer <token>
Response: 200 OK
```

#### Bulk Status Update
```
POST /api/uniforms/bulk/status
Headers: Authorization: Bearer <token>
Request: {
  "barcodes": ["SHIRT001", "SHIRT002"],
  "status": "In Laundry"
}
Response: 200 OK
```

#### Delete Uniform (Admin only)
```
DELETE /api/uniforms/{barcode}
Headers: Authorization: Bearer <token>
Response: 204 No Content
```

## Error Responses

### 400 Bad Request - Invalid Status
```json
{
  "status": 400,
  "message": "Invalid status: InvalidStatus. Allowed values: In Stock, Issued, In Laundry, Damaged, Lost, In Hamper (alias for In Laundry)",
  "timestamp": 1234567890
}
```

### 400 Bad Request - Invalid Transition
```json
{
  "status": 400,
  "message": "Invalid status transition from 'In Stock' to 'In Laundry'. Allowed transitions: Issued",
  "timestamp": 1234567890
}
```

### 400 Bad Request - Validation Error
```json
{
  "status": 400,
  "message": "Validation failed",
  "errors": [
    "barcode: Barcode is required",
    "name: Name is required"
  ],
  "timestamp": 1234567890
}
```

### 409 Conflict - Duplicate Barcode
```json
{
  "status": 409,
  "message": "Uniform with barcode 'SHIRT001' already exists",
  "timestamp": 1234567890
}
```

### 404 Not Found
```json
{
  "status": 404,
  "message": "Uniform with barcode 'NONEXISTENT' not found",
  "timestamp": 1234567890
}
```

### 403 Forbidden - Insufficient Permissions
```json
{
  "status": 403,
  "message": "Access denied",
  "timestamp": 1234567890
}
```

## Building and Running

### Prerequisites
- Java 17
- Maven 3.6+

### Build
```bash
mvn clean install
```

### Run
```bash
mvn spring-boot:run
```

The application will start on `http://localhost:8080`

### Run Tests
```bash
mvn test
```

## Database
- H2 in-memory database (development)
- Console available at: `http://localhost:8080/h2-console`
  - JDBC URL: `jdbc:h2:mem:testdb`
  - Username: `sa`
  - Password: `password`

## Configuration
Application configuration is in `src/main/resources/application.yml`

## Testing with cURL

### 1. Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 2. Create Uniform
```bash
curl -X POST http://localhost:8080/api/uniforms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Blue Shirt","barcode":"SHIRT001","status":"In Stock","category":"Shirt"}'
```

### 3. Test Android Compatibility (In Hamper → In Laundry)
```bash
curl -X POST http://localhost:8080/api/uniforms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Item","barcode":"TEST001","status":"In Hamper","category":"Test"}'
```

### 4. Test Duplicate Barcode (should return 409)
```bash
curl -X POST http://localhost:8080/api/uniforms \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Duplicate","barcode":"SHIRT001","status":"In Stock","category":"Shirt"}'
```

## Architecture

### Layers
1. **Controller Layer** - REST API endpoints with security annotations
2. **Service Layer** - Business logic, validation, transaction management
3. **Repository Layer** - JPA data access
4. **Model Layer** - JPA entities
5. **Security Layer** - JWT authentication, role-based access control

### Key Components
- `UniformController` - Main API endpoints
- `UniformService` - Business logic for uniform operations
- `HamperService` - Hamper count management
- `JwtUtil` - JWT token generation and validation
- `CustomUserDetailsService` - User authentication
- `SecurityConfig` - Spring Security configuration
- `GlobalExceptionHandler` - Centralized error handling
- `UniformStatus` - Status enum with transition validation

## Notes
- Terminal states (Damaged, Lost) prevent further transitions unless restored by admin
- Hamper counts use soft limits - can exceed capacity but log warnings
- All timestamps use system time (UTC recommended for production)
- JWT tokens expire after 24 hours
