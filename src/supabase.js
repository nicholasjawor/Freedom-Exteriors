import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://klfrqwplazjryeppamtk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsZnJxd3BsYXpqcnllcHBhbXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTgwNjMsImV4cCI6MjA5NDc3NDA2M30.Yt5N861eMm7r8YIavdYmMGeiS8oYYZ9nu5rZnslQ9CE';
export const supabase = createClient(supabaseUrl, supabaseKey);