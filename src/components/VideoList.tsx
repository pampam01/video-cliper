import { useEffect, useState } from 'react';
import { Video, Film, Clock, Scissors } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Video as VideoType } from '../lib/supabase';

interface VideoListProps {
  onVideoSelect: (video: VideoType) => void;
  refresh: number;
}

export function VideoList({ onVideoSelect, refresh }: VideoListProps) {
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, [refresh]);

  const loadVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (err) {
      console.error('Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <Video className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No videos uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videos.map((video) => (
        <div
          key={video.id}
          onClick={() => onVideoSelect(video)}
          className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform transition-transform hover:scale-105"
        >
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 h-48 flex items-center justify-center">
            <Film className="w-16 h-16 text-white opacity-50" />
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-gray-800 mb-2 truncate">{video.title}</h3>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>{formatDuration(video.duration)}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVideoSelect(video);
                }}
                className="flex items-center text-blue-600 hover:text-blue-700"
              >
                <Scissors className="w-4 h-4 mr-1" />
                <span>Create Clips</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
