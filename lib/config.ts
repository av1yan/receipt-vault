// Public Supabase config for the receipt-extraction edge function.
// The anon key is a publishable client credential (safe to ship in the app);
// the Anthropic API key it fronts stays server-side in the edge function.
//
// NOTE: currently points at the shared "Habit Tracker" Supabase project — the
// extract-receipt function is self-contained there. Move to a dedicated
// Receipt Vault project later by swapping these two values.
export const SUPABASE_URL = 'https://diifnystxiwurucolavk.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpaWZueXN0eGl3dXJ1Y29sYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNjk5MjAsImV4cCI6MjEwMDY0NTkyMH0.MrqJd3xCivx0veY75uua5OfLe1Fh-5VDYmVdgnfIUr8';
