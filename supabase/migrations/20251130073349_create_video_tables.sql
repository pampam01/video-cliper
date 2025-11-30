/*
  # Video Upload and Clips System

  1. New Tables
    - `videos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `file_path` (text) - Path to original video in storage
      - `duration` (numeric) - Duration in seconds
      - `status` (text) - processing, completed, failed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `video_clips`
      - `id` (uuid, primary key)
      - `video_id` (uuid, references videos)
      - `title` (text)
      - `file_path` (text) - Path to clip in storage
      - `start_time` (numeric) - Start time in seconds
      - `duration` (numeric) - Duration in seconds
      - `thumbnail_path` (text) - Path to thumbnail
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can view and manage their own videos
    - Users can view and download their own clips
*/

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_path text NOT NULL,
  duration numeric DEFAULT 0,
  status text DEFAULT 'processing',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create video_clips table
CREATE TABLE IF NOT EXISTS video_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES videos(id) ON DELETE CASCADE,
  title text NOT NULL,
  file_path text NOT NULL,
  start_time numeric NOT NULL,
  duration numeric NOT NULL,
  thumbnail_path text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_clips ENABLE ROW LEVEL SECURITY;

-- Videos policies
CREATE POLICY "Users can view own videos"
  ON videos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own videos"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos"
  ON videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos"
  ON videos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Video clips policies
CREATE POLICY "Users can view own clips"
  ON video_clips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_clips.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert clips for own videos"
  ON video_clips FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_clips.video_id
      AND videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own clips"
  ON video_clips FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos
      WHERE videos.id = video_clips.video_id
      AND videos.user_id = auth.uid()
    )
  );