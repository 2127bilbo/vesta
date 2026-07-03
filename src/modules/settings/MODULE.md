# Settings Module

**Status:** Scaffolded (v1)
**Phase:** Build in Phase 6

## Responsibility
User profile, household management, invite partner flow, notification preferences.

## Screens
- Profile view/edit (display name, color)
- Household name
- Invite Partner (generate code, share link)
- Join Household (enter code)
- Notification settings (enable/disable push)
- Sign out

## Tables Used
- profiles (read/update own)
- households (read/update own)
- invites (create, read own)

## Dependencies
- shared/supabase.js
- shared/auth.js
- shared/components/
