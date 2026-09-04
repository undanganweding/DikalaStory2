# SINEMA Database Migration Rollback Procedure

## Overview
This document defines the emergency rollback procedure from Supabase PostgreSQL back to legacy Firestore.

## Trigger Conditions for Rollback
- Critical unrecoverable database connectivity failure on Supabase Cloud.
- Data corruption issue affecting production write path.

## Rollback Steps

### Step 1: Change Authority Variable
In Cloud Run / AI Studio environment configuration:
Set:
```env
SUPABASE_ENABLED=false
```

### Step 2: Restart Application Server
Restart the development/production container.

### Step 3: Verify Driver Resolver Output
Ensure logs output on boot:
```
[DB INIT] SUPABASE_ENABLED=false ... USE_FIRESTORE=true
```

### Step 4: Verify Firestore Read Authority
Run:
```bash
npm run test:supabase-phase2
```
Confirm Test 1 passes (`When SUPABASE_ENABLED=false, getDatabaseDriver() returns firestoreDb`).

## Emergency Recovery Data Verification
The legacy snapshot `/data/migration_package_live_20260903.json` remains frozen as an offline reference. Firestore database documents are preserved intact and unmodified.
