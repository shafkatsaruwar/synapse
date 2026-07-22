# Synapse Security & Privacy Documentation

## Overview

Synapse is a health tracking application that handles sensitive personal health information (PHI). This document outlines the security measures implemented to protect user data and maintain HIPAA compliance.

## Security Features Implemented

### 1. Authentication & Authorization
- **Real Supabase Authentication**: Implements proper OAuth 2.0 with Supabase
- **Session Management**: Automatic token refresh and session validation
- **Secure Credential Storage**: Auth tokens stored in encrypted secure storage
- **Audit Logging**: All authentication events logged with timestamps

**Files**: `contexts/AuthContext.tsx`, `lib/supabase.ts`

### 2. Data Encryption

#### At Rest
- **Secure Storage**: Sensitive credentials stored in `expo-secure-store` (device keychain)
- **Data Encryption**: Health data encrypted with AES-256 before storage
- **Encryption Keys**: Master encryption key stored securely and never exposed

**Files**: `lib/secure-storage.ts`, `lib/encryption.ts`

#### In Transit
- **TLS/HTTPS**: All API calls use HTTPS with certificate pinning ready
- **Request Signing**: API requests include authorization tokens
- **Error Sanitization**: Sensitive data stripped from error messages

**Files**: `lib/api.ts`

### 3. Input Validation & Sanitization
- **Zod Validation**: All inputs validated against strict schemas
- **XSS Prevention**: User inputs sanitized to remove HTML/JS
- **SQL Injection Prevention**: No direct SQL queries; uses parameterized Supabase SDK
- **Phone/Email Validation**: Regex validation for specific formats
- **Length Limits**: All strings truncated to prevent buffer overflows

**Files**: `lib/validation.ts`, `lib/validated-storage.ts`

### 4. Secure ID Generation
- **UUID v4**: All entity IDs use cryptographically secure random UUIDs
- **No Predictable IDs**: Replaced weak `Date.now()` + `Math.random()` patterns

**Files**: `lib/storage.ts`

### 5. Audit Logging (HIPAA Compliance)
- **Complete Audit Trail**: All data access, creation, modification, deletion logged
- **Retention**: Audit logs retained for 90 days minimum
- **Log Contents**: 
  - Action (CREATE, READ, UPDATE, DELETE, AUTH, ERROR)
  - Entity type and ID
  - User ID and timestamp
  - Result status (success/failure)
  - Sanitized error messages
- **No PII in Logs**: Sensitive data never logged

**Files**: `lib/audit-logger.ts`

### 6. Data Retention & Privacy
- **Automatic Cleanup**: Old health records automatically deleted per retention policy
- **Default Retention**: 2 years for most data, 5 years for medical records
- **Configurable Policies**: Healthcare providers can adjust retention
- **GDPR Compliance**: User data can be exported or deleted on request

**Files**: `lib/data-retention.ts`

### 7. API Security
- **Bearer Token Auth**: JWT tokens included in all API requests
- **Timeout Protection**: 30-second timeout on all API calls
- **Retry Logic**: Exponential backoff retry strategy (up to 3 attempts)
- **Rate Limiting Ready**: Foundation for server-side rate limiting
- **Response Validation**: All API responses validated against schemas

**Files**: `lib/api.ts`, `lib/validation.ts`

### 8. Error Handling
- **Safe Error Messages**: User-facing errors don't leak system details
- **Logging Without Exposure**: Errors logged for debugging but sanitized
- **Graceful Failures**: App continues functioning if non-critical operations fail

**Files**: `lib/api.ts`, `lib/audit-logger.ts`

## Security Best Practices

### Environment Variables
1. **Never commit secrets**: `.env` file excluded from git
2. **Public anon key only**: Supabase anon key is safe to commit (public by design)
3. **Use `.env.example`**: Template shows required variables without actual values
4. **EAS secrets**: Use Expo's EAS for production secrets

### Data Handling
1. **Minimize PHI**: Only collect data user explicitly enters
2. **No third-party analytics**: No external tracking of health data
3. **Encryption by default**: All sensitive fields encrypted at rest
4. **User consent**: Clear disclosure of data collection practices

### Code Security
1. **Input validation**: Zod schemas validate all data
2. **Type safety**: TypeScript ensures type correctness
3. **No eval()**: No dynamic code execution
4. **Regular updates**: Keep dependencies current

## Data Storage Locations

| Data Type | Storage | Encryption | Retention |
|-----------|---------|-----------|-----------|
| Auth tokens | SecureStore (keychain) | Yes | Session duration |
| Health logs | AsyncStorage | Yes | 2 years |
| Medications | AsyncStorage | Yes | 2 years |
| Appointments | AsyncStorage | Yes | 2 years |
| Lab results | AsyncStorage | Yes | 5 years |
| Audit logs | AsyncStorage | Yes | 90 days |
| Settings | AsyncStorage | No | Indefinite |

## Supabase Security

### Row Level Security (RLS)
Configure in Supabase dashboard:
```sql
-- Only allow users to access their own data
ALTER POLICY "Users can access own data" ON health_logs
USING (auth.uid() = user_id);
```

### API Keys
- **Anon Key**: Public, limited scope (sign-up, sign-in only)
- **Service Role Key**: Secret, full database access (backend only)
- **Never commit Service Role Key** to version control

## Compliance

### HIPAA
- ✅ Audit logging of all PHI access
- ✅ Encryption of PHI at rest and in transit
- ✅ User authentication required
- ✅ Data retention policies
- ✅ Error handling without exposing PHI

### GDPR
- ✅ Data export functionality
- ✅ Data deletion capability
- ✅ Clear consent/disclosure
- ✅ Minimal data collection
- ✅ User control over data

### CCPA
- ✅ Right to know (data export)
- ✅ Right to delete (data cleanup)
- ✅ Data sale prohibited (no third-party sharing)

## Security Testing

### Regular Reviews
- [ ] Audit logs for suspicious activity
- [ ] Update dependencies monthly
- [ ] Review Supabase security settings
- [ ] Test encryption/decryption functions
- [ ] Verify validation schemas

### Penetration Testing Checklist
- [ ] Test SQL injection (parameterized queries)
- [ ] Test XSS (input sanitization)
- [ ] Test authentication bypass (session validation)
- [ ] Test CSRF (token verification)
- [ ] Test data leakage (error messages, logs)

## Incident Response

If a security breach is suspected:
1. **Immediate**: Disable affected accounts
2. **Investigation**: Review audit logs for unauthorized access
3. **Notification**: Inform affected users per applicable laws
4. **Remediation**: Rotate credentials, patch vulnerabilities
5. **Prevention**: Update retention policies and monitoring

## Security Contacts

- Security Issues: Report privately via GitHub Security Advisory
- Privacy Questions: Contact health@synapse-health.app
- Legal/Compliance: compliance@synapse-health.app

## References

- [Supabase Security](https://supabase.com/docs/guides/auth)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [HIPAA Compliance](https://www.hhs.gov/hipaa/)
- [React Native Security](https://reactnative.dev/docs/security)
- [Expo Security](https://docs.expo.dev/security/)
