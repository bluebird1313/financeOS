# Production Readiness Checklist - Life Financial OS

## ✅ Already Production-Ready
- [x] Plaid Edge Functions support production environment (dynamically switches based on `PLAID_ENV`)
- [x] Row Level Security (RLS) enabled on all 11 tables (42 policies total)
- [x] Database schema with proper indexes
- [x] JWT verification enabled on all Edge Functions
- [x] Function search_path security issues FIXED
- [x] Vector extension moved to extensions schema
- [x] Drip campaign unused functions removed

---

## 🔄 Waiting on Plaid Approval
Once Plaid approves your production application, update these Supabase Edge Function secrets:

### Supabase Dashboard → Edge Functions → Secrets
```
PLAID_ENV=production
PLAID_CLIENT_ID=<your_production_client_id>
PLAID_SECRET=<your_production_secret>
```

**How to update:**
1. Go to: https://supabase.com/dashboard/project/vdelxzzoqidyibjucywj/settings/functions
2. Click "Manage Secrets"
3. Update the three Plaid variables above

---

## ⚠️ Security Issues to Fix NOW

### 1. Enable Leaked Password Protection
- **Dashboard:** Auth → Providers → Email → Enable "Leaked password protection"
- **URL:** https://supabase.com/dashboard/project/vdelxzzoqidyibjucywj/auth/providers

### 2. Enable MFA Options
- **Dashboard:** Auth → Providers → MFA → Enable TOTP
- **URL:** https://supabase.com/dashboard/project/vdelxzzoqidyibjucywj/auth/providers

### 3. Upgrade PostgreSQL (Security Patches)
- **Dashboard:** Settings → Infrastructure → Upgrade Database
- **URL:** https://supabase.com/dashboard/project/vdelxzzoqidyibjucywj/settings/infrastructure

### 4. Fix Function Search Paths (SQL to run)
Run this SQL in Supabase SQL Editor to fix the security warnings:

```sql
-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Drop unused functions if they exist (from other projects/migrations)
DROP FUNCTION IF EXISTS public.create_drip_tables_if_not_exist();
DROP FUNCTION IF EXISTS public.add_lead_to_drip_campaign(UUID, UUID, INTEGER);
```

### 5. Move Vector Extension from Public Schema
```sql
-- Create extensions schema if not exists
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move vector extension
DROP EXTENSION IF EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;
```

---

## 📋 Environment Variables Template

### Frontend (.env)
```env
# Supabase
VITE_SUPABASE_URL=https://vdelxzzoqidyibjucywj.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>

# Plaid (not used in frontend, but for reference)
# Plaid credentials are stored in Supabase Edge Function secrets only
VITE_PLAID_ENV=production

# OpenAI (if using AI features)
VITE_OPENAI_API_KEY=<your_openai_key>
```

### Supabase Edge Function Secrets
```
PLAID_CLIENT_ID=<production_client_id>
PLAID_SECRET=<production_secret>
PLAID_ENV=production
OPENAI_API_KEY=<your_openai_key>
```

---

## 🔒 Production Security Checklist

- [ ] Enable leaked password protection in Supabase Auth
- [ ] Enable MFA (TOTP) for user accounts
- [ ] Upgrade PostgreSQL to latest version
- [ ] Fix function search_path security warnings
- [ ] Move vector extension to extensions schema
- [ ] Verify all RLS policies are working correctly
- [ ] Test with production Plaid credentials
- [ ] Remove any console.log statements with sensitive data
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Configure backup retention policy
- [ ] Document data retention/deletion procedures

---

## 🚀 Go-Live Steps (After Plaid Approval)

1. **Update Plaid Secrets in Supabase:**
   - PLAID_ENV → `production`
   - PLAID_CLIENT_ID → Your production client ID
   - PLAID_SECRET → Your production secret

2. **Test Connection:**
   - Try connecting a real bank account
   - Verify transactions sync correctly
   - Check account balances update

3. **Monitor:**
   - Watch Supabase Edge Function logs for errors
   - Check Plaid Dashboard for API errors
   - Monitor user feedback

---

## 📞 Support Contacts

- **Plaid Support:** https://dashboard.plaid.com/support
- **Supabase Support:** https://supabase.com/dashboard/support
- **Documentation:** 
  - Plaid: https://plaid.com/docs/
  - Supabase: https://supabase.com/docs/

---

*Last Updated: November 30, 2024*

