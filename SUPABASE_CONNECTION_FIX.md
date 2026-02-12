# 🔧 Supabase Connection Fix

The hostname `db.opvdeseruaaekeghuqvx.supabase.co` isn't resolving. Try these:

## Option 1: Use Connection Pooling URL (Recommended)

In Supabase Dashboard:
1. Go to **Settings** → **Database**
2. Find **Connection pooling** section
3. Select **Session mode** or **Transaction mode**
4. Copy that connection string instead
5. It should look like: `postgresql://postgres.xxxxx:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

## Option 2: Check Database Status

1. Go to your Supabase project dashboard
2. Make sure the database is **fully initialized** (should show "Active")
3. Sometimes it takes a few minutes after creation

## Option 3: Verify Hostname

The hostname format should be:
- Direct: `db.PROJECT_REF.supabase.co:5432`
- Pooler: `aws-0-REGION.pooler.supabase.com:6543`

Make sure you copied the correct one from Supabase!
