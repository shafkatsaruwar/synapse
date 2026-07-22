# Security Quick Start Guide

## For Developers

### 1. Setup Credentials (Do This First)

```bash
cp .env.example .env
# Edit .env and add your Supabase credentials
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Use Authentication

```typescript
import { useAuth } from "@/contexts/AuthContext";

export function MyComponent() {
  const { user, session, signIn, signOut, loading } = useAuth();

  if (loading) return <ActivityIndicator />;
  if (!session) return <SignInScreen />;

  return (
    <>
      <Text>Welcome, {user?.email}</Text>
      <Button onPress={signOut} title="Sign Out" />
    </>
  );
}
```

### 4. Save Data Safely

Use `validatedMedicationStorage` instead of raw `medicationStorage`:

```typescript
import { validatedMedicationStorage } from "@/lib/validated-storage";

// Validation happens automatically
const medication = await validatedMedicationStorage.save({
  name: "Aspirin",
  dosage: "500mg",
  frequency: "Once daily",
  active: true,
});
// ✅ Audit logged automatically
// ✅ Input sanitized
// ✅ Data encrypted when stored
```

### 5. Make API Calls

All API calls are now secure:

```typescript
import { analyzeDocument, getHealthInsights } from "@/lib/api";

// Automatic validation, auth headers, retry logic
try {
  const result = await analyzeDocument(base64Image, "image/jpeg");
  // ✅ Response validated against schema
  // ✅ Errors sanitized
  // ✅ Audit logged
} catch (error) {
  // Safe error message (no sensitive data)
  console.error(error.message);
}
```

### 6. Check Audit Logs

```typescript
import { auditLogger } from "@/lib/audit-logger";

// Get all medication creation events
const medCreations = await auditLogger.getLogsByAction("CREATE");

// Get all user actions
const userActions = await auditLogger.getLogsForUser(userId);

// Export for compliance
const allLogs = await auditLogger.exportLogs();
```

### 7. Cleanup Old Data

```typescript
import { dataRetentionManager } from "@/lib/data-retention";

// Automatic daily cleanup (runs once per 24 hours)
await dataRetentionManager.cleanup();

// Check/modify policies
const policies = await dataRetentionManager.getPolicies();
// Default: 2 years for health data, 5 years for medical records
```

### 8. Encrypt Sensitive Data

```typescript
import { encryptSensitiveData, decryptSensitiveData } from "@/lib/encryption";

// Store encrypted
const encrypted = await encryptSensitiveData(JSON.stringify(sensitiveData));
await AsyncStorage.setItem("secret", encrypted);

// Retrieve decrypted
const secret = await AsyncStorage.getItem("secret");
const decrypted = await decryptSensitiveData(secret);
const data = JSON.parse(decrypted);
```

## For Administrators

### Monitor Audit Logs

```bash
# Export logs weekly for review
adb shell "run-as com.synapse.health \
  find /data/data/com.synapse.health/files/RCTAsyncLocalStorage \
  -name '*audit*' -exec cat {} \;"
```

### Review Data Retention

```typescript
// In admin panel
import { dataRetentionManager } from "@/lib/data-retention";

const policies = await dataRetentionManager.getPolicies();
// Customize retention periods
await dataRetentionManager.setPolicies([
  { entityType: "healthLog", retentionDays: 3 * 365, enabled: true },
  // ... more policies
]);
```

### Check Supabase Security

1. **Enable Row Level Security**
   ```sql
   ALTER POLICY "Users can access own data" ON medications
   USING (auth.uid() = user_id);
   ```

2. **Rotate API Keys**
   - Monthly in Supabase Dashboard
   - Update .env after rotation

3. **Monitor Auth Events**
   - Check Supabase Dashboard → Auth
   - Look for failed sign-in attempts

## Common Tasks

### Debug Authentication Issues

```typescript
const { session, user, loading } = useAuth();

if (loading) console.log("Auth initializing...");
if (!session) console.log("User not authenticated");
if (user) console.log("User:", user.email);
```

### Validate Input Before Saving

```typescript
import { validateInput, MedicationSchema } from "@/lib/validation";

try {
  const validated = validateInput(MedicationSchema, userInput);
  // Safe to use now
} catch (error) {
  console.error("Validation failed:", error.message);
}
```

### Add Custom Audit Log Entry

```typescript
import { auditLogger } from "@/lib/audit-logger";

await auditLogger.log("UPDATE", "health_log", "success", {
  entityId: logId,
  userId: currentUser.id,
  details: `Updated health log for ${date}`,
});
```

## Security Checklist Before Deployment

- [ ] Supabase RLS policies configured
- [ ] Audit logs retention set to 90+ days
- [ ] Data retention policies reviewed
- [ ] .env file configured with real credentials
- [ ] npm install completed (includes Zod)
- [ ] All auth tests passing
- [ ] Encryption/decryption tests passing
- [ ] Error messages don't leak sensitive data
- [ ] All API endpoints use validation
- [ ] Backup strategy documented

## Troubleshooting

### "Supabase not initialized"
```bash
# Make sure .env has credentials
grep EXPO_PUBLIC_SUPABASE .env
# Run npm install again
npm install
```

### "Validation failed"
```typescript
// Check schema requirements
import { MedicationSchema } from "@/lib/validation";
// Add all required fields
```

### "Encryption failed"
```typescript
// Fallback is already in place
// Will use base64 encoding if encryption fails
// Check logs for details
```

### "Audit log full"
```typescript
// Runs automatically
await auditLogger.cleanupOldLogs();
```

## Support

- **Security Issues**: Report via GitHub Security Advisory
- **Questions**: Check SECURITY.md for details
- **Compliance**: See IMPLEMENTATION_SUMMARY.md

## Resources

- [SECURITY.md](./SECURITY.md) - Comprehensive security guide
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - What was fixed
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Zod Validation Guide](https://zod.dev)
