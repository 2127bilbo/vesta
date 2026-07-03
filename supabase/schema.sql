-- =============================================================================
-- VESTA SCHEMA v1
-- Designed: Phase 3 | Apply via Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- HOUSEHOLDS
-- Links two users together. All data is scoped to a household.
-- -----------------------------------------------------------------------------
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT DEFAULT 'Home',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- PROFILES
-- Extends auth.users with app-specific data. One row per user.
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID REFERENCES households(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  color TEXT NOT NULL CHECK (color IN ('bob', 'chassidy')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- EVENTS
-- Calendar events, scoped to household. Owner determines metallic color.
-- -----------------------------------------------------------------------------
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  reminder_minutes INTEGER, -- minutes before start_at to send push
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- LISTS
-- Container for check-off lists (Grocery, Home, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT, -- Lucide icon name
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- LIST_ITEMS
-- Individual items within a list. Tracks who checked for notifications.
-- -----------------------------------------------------------------------------
CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  checked BOOLEAN DEFAULT false,
  checked_by UUID REFERENCES profiles(id),
  checked_at TIMESTAMPTZ,
  added_by UUID REFERENCES profiles(id),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- INVITES
-- Allows one user to invite another to join their household
-- -----------------------------------------------------------------------------
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
CREATE INDEX idx_profiles_household ON profiles(household_id);
CREATE INDEX idx_events_household ON events(household_id);
CREATE INDEX idx_events_start ON events(start_at);
CREATE INDEX idx_lists_household ON lists(household_id);
CREATE INDEX idx_list_items_list ON list_items(list_id);
CREATE INDEX idx_list_items_checked ON list_items(checked) WHERE checked = false;
CREATE INDEX idx_invites_code ON invites(code);
CREATE INDEX idx_invites_household ON invites(household_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's household_id
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- HOUSEHOLDS: users can only see their own household
CREATE POLICY "Users can view own household"
  ON households FOR SELECT
  USING (id = get_my_household_id());

CREATE POLICY "Users can update own household"
  ON households FOR UPDATE
  USING (id = get_my_household_id());

-- PROFILES: users can see profiles in their household
CREATE POLICY "Users can view household profiles"
  ON profiles FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- EVENTS: full CRUD within household
CREATE POLICY "Users can view household events"
  ON events FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "Users can insert household events"
  ON events FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "Users can update household events"
  ON events FOR UPDATE
  USING (household_id = get_my_household_id());

CREATE POLICY "Users can delete household events"
  ON events FOR DELETE
  USING (household_id = get_my_household_id());

-- LISTS: full CRUD within household
CREATE POLICY "Users can view household lists"
  ON lists FOR SELECT
  USING (household_id = get_my_household_id());

CREATE POLICY "Users can insert household lists"
  ON lists FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "Users can update household lists"
  ON lists FOR UPDATE
  USING (household_id = get_my_household_id());

CREATE POLICY "Users can delete household lists"
  ON lists FOR DELETE
  USING (household_id = get_my_household_id());

-- LIST_ITEMS: full CRUD if user owns the parent list's household
CREATE POLICY "Users can view household list items"
  ON list_items FOR SELECT
  USING (
    list_id IN (SELECT id FROM lists WHERE household_id = get_my_household_id())
  );

CREATE POLICY "Users can insert household list items"
  ON list_items FOR INSERT
  WITH CHECK (
    list_id IN (SELECT id FROM lists WHERE household_id = get_my_household_id())
  );

CREATE POLICY "Users can update household list items"
  ON list_items FOR UPDATE
  USING (
    list_id IN (SELECT id FROM lists WHERE household_id = get_my_household_id())
  );

CREATE POLICY "Users can delete household list items"
  ON list_items FOR DELETE
  USING (
    list_id IN (SELECT id FROM lists WHERE household_id = get_my_household_id())
  );

-- INVITES: users can manage their own invites, anyone can lookup by code
CREATE POLICY "Users can view own invites"
  ON invites FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Anyone can lookup invite by code"
  ON invites FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create invites"
  ON invites FOR INSERT
  WITH CHECK (household_id = get_my_household_id());

CREATE POLICY "Users can update own invites"
  ON invites FOR UPDATE
  USING (created_by = auth.uid());

-- =============================================================================
-- REALTIME
-- Enable realtime for sync between devices
-- =============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE lists;
ALTER PUBLICATION supabase_realtime ADD TABLE list_items;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at on events
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile when user signs up (with explicit schema reference)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, color)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'color', 'bob')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile creation failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- POST-V1 TABLES (sketched, not created)
-- =============================================================================
-- recipes: id, household_id, title, ingredients JSONB, instructions TEXT[],
--          servings, prep_time, cook_time, tags[], image_url, created_at
--
-- fund_transactions: id, household_id, amount, note, added_by, created_at
--          (vacation fund is sum of all transactions)
--
-- decisions: id, household_id, question, options JSONB, result, decided_at
--          (The Decider history)
