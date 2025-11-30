import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Video = {
  id: string;
  user_id: string;
  title: string;
  file_path: string;
  duration: number;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
};

export type VideoClip = {
  id: string;
  video_id: string;
  title: string;
  file_path: string;
  start_time: number;
  duration: number;
  thumbnail_path: string | null;
  created_at: string;
};
