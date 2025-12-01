# Data Minimization, Deletion, and Retention Policy

**Life Financial Operating System**  
**Effective Date:** November 30, 2024  
**Last Updated:** November 30, 2024

---

## 1. Purpose

This policy establishes guidelines for data minimization, retention, and deletion practices for Life Financial Operating System ("the Application"). This policy ensures compliance with applicable data privacy laws including the California Consumer Privacy Act (CCPA), General Data Protection Regulation (GDPR), and the Gramm-Leach-Bliley Act (GLBA).

---

## 2. Scope

This policy applies to all personal and financial data collected, processed, and stored by the Application, including data obtained through third-party services such as Plaid.

---

## 3. Data Minimization Principles

### 3.1 Collection Limitation
We collect only the minimum data necessary to provide our services:

| Data Category | Purpose | Necessity |
|---------------|---------|-----------|
| Account credentials (via Plaid) | Bank account linking | Essential for core functionality |
| Transaction history | Financial tracking & analysis | Essential for core functionality |
| Account balances | Net worth calculation | Essential for core functionality |
| Account/routing numbers | Payment verification | Only when explicitly requested by user |
| User email & authentication | Account security | Essential for user identification |

### 3.2 Data We Do NOT Collect
- Bank login credentials (handled securely by Plaid)
- Social Security Numbers
- Full credit card numbers
- Investment account passwords
- Data from accounts not explicitly connected by the user

---

## 4. Data Retention Schedule

### 4.1 Active User Data

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Transaction data | Duration of account + 7 years | Tax/legal compliance requirements |
| Account connection tokens | Until user disconnects or 1 year of inactivity | Ongoing service provision |
| Account balances (historical) | Duration of account + 7 years | Financial reporting & analysis |
| User profile information | Duration of account | Account functionality |
| Authentication logs | 90 days | Security monitoring |
| Error/debug logs | 30 days | Technical troubleshooting |

### 4.2 Inactive User Data

| Inactivity Period | Action Taken |
|-------------------|--------------|
| 6 months | User notified of pending data review |
| 12 months | Account marked as inactive; Plaid tokens refreshed or revoked |
| 18 months | User notified of pending account deletion |
| 24 months | Account and associated data permanently deleted |

---

## 5. Data Deletion Procedures

### 5.1 User-Initiated Deletion

Users may request deletion of their data at any time through:
- In-app account deletion feature (Settings → Delete Account)
- Email request to [support email]
- Written request to company address

**Process:**
1. User submits deletion request
2. Identity verification completed within 24 hours
3. User receives confirmation of request receipt
4. Data deletion completed within 30 days
5. User receives confirmation of deletion completion

### 5.2 Automated Deletion

The following data is automatically deleted:
- Temporary session data: Deleted upon session end
- Failed authentication attempts: Purged after 24 hours
- Cached financial data: Refreshed daily, old cache purged
- Debug logs: Auto-purged after 30 days

### 5.3 Third-Party Data Deletion (Plaid)

When a user deletes their account or disconnects a financial institution:
1. Application immediately revokes Plaid access token
2. Plaid API called to delete Item connection
3. Local copies of Plaid-sourced data are purged
4. Deletion confirmation logged for compliance records

**Plaid API Deletion Call:**
```
DELETE /item/remove
```

---

## 6. Data Storage Security

### 6.1 Data at Rest
- All financial data encrypted using AES-256 encryption
- Database hosted on Supabase with encryption enabled
- Encryption keys managed separately from data storage

### 6.2 Data in Transit
- All API communications use TLS 1.3
- Plaid Link uses secure iframe isolation
- No financial data transmitted via unencrypted channels

### 6.3 Access Controls
- Role-based access control (RBAC) implemented
- Principle of least privilege enforced
- All data access logged and auditable

---

## 7. User Rights

### 7.1 Right to Access
Users can export all their data in machine-readable format (JSON/CSV) via Settings → Export Data.

### 7.2 Right to Rectification
Users can update their profile information at any time. Financial data sourced from institutions is read-only but can be refreshed.

### 7.3 Right to Erasure ("Right to be Forgotten")
Users can request complete deletion of all personal data. See Section 5.1.

### 7.4 Right to Data Portability
Users can download their complete data archive including:
- Transaction history
- Account information
- User preferences
- Historical balance data

### 7.5 Right to Withdraw Consent
Users can disconnect any linked financial institution at any time, immediately revoking data access.

---

## 8. Compliance Framework

### 8.1 CCPA Compliance
- Right to know what data is collected ✓
- Right to delete personal information ✓
- Right to opt-out of data sale ✓ (We do not sell data)
- Right to non-discrimination ✓

### 8.2 GDPR Compliance (for EU users)
- Lawful basis for processing documented ✓
- Data minimization principles followed ✓
- Storage limitation enforced ✓
- Data subject rights implemented ✓

### 8.3 GLBA Compliance
- Privacy notice provided ✓
- Opt-out rights communicated ✓
- Safeguards rule compliance ✓

---

## 9. Policy Enforcement

### 9.1 Regular Audits
- Quarterly review of data retention compliance
- Annual third-party security assessment
- Continuous monitoring of data access patterns

### 9.2 Breach Response
In the event of a data breach:
1. Affected users notified within 72 hours
2. Relevant authorities notified as required by law
3. Incident documented and remediation implemented
4. Policy reviewed and updated if necessary

---

## 10. Policy Updates

This policy is reviewed and updated annually, or whenever:
- Applicable laws change
- New data types are collected
- Third-party integrations change
- Security incidents occur

Users will be notified of material changes via email and in-app notification.

---

## 11. Contact Information

For questions about this policy or to exercise your data rights:

**Data Protection Inquiries:**  
Email: [Your support email]  
Response time: Within 48 hours

---

## 12. Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 30, 2024 | [Your Name] | Initial policy creation |

---

*This policy demonstrates our commitment to protecting user privacy and handling financial data responsibly in compliance with all applicable regulations.*

