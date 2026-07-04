// Auth helpers and hooks — all modules import from here for auth state.
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from './supabase';

// -----------------------------------------------------------------------------
// Auth Context
// -----------------------------------------------------------------------------
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout fallback - don't hang forever
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timeout - forcing complete');
        setLoading(false);
      }
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    }).catch((err) => {
      console.error('Auth getSession error:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, households(*)')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    refreshProfile: () => session?.user && fetchProfile(session.user.id),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Auth Functions
// -----------------------------------------------------------------------------
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, metadata = {}) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata, // { display_name, color }
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Household / Invite Functions
// -----------------------------------------------------------------------------
export async function createHousehold(name = 'Home') {
  const { data, error } = await supabase
    .from('households')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function joinHouseholdByCode(code) {
  // Find the invite
  const { data: invite, error: inviteErr } = await supabase
    .from('invites')
    .select('*')
    .eq('code', code.toLowerCase().trim())
    .is('used_by', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (inviteErr || !invite) {
    throw new Error('Invalid or expired invite code');
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Update profile to join household
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ household_id: invite.household_id })
    .eq('id', user.id);

  if (profileErr) throw profileErr;

  // Mark invite as used
  await supabase
    .from('invites')
    .update({ used_by: user.id, used_at: new Date().toISOString() })
    .eq('id', invite.id);

  return invite.household_id;
}

export async function createInvite() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Get user's household
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single();

  if (!profile?.household_id) {
    throw new Error('You must be in a household to create an invite');
  }

  const { data, error } = await supabase
    .from('invites')
    .insert({
      household_id: profile.household_id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
