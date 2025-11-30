import { useState, useRef, useEffect } from 'react';
import { X, Scissors, Plus, Trash2, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Video, VideoClip } from '../lib/supabase';

interface ClipCreatorProps {
  video: Video;
  onClose: () => void;
}

interface ClipSegment {
  start: number;
  duration: number;
  title: string;
}

export function ClipCreator({ video, onClose }: ClipCreatorProps) {
  const [clips, setClips] = useState<ClipSegment[]>([]);
  const [clipDuration, setClipDuration] = useState(30);
  const [generating, setGenerating] = useState(false);
  const [generatedClips, setGeneratedClips] = useState<VideoClip[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');

  useEffect(() => {
    loadVideoUrl();
    loadExistingClips();
  }, [video]);

  const loadVideoUrl = async () => {
    const { data } = supabase.storage
      .from('videos')
      .getPublicUrl(video.file_path);
    setVideoUrl(data.publicUrl);
  };

  const loadExistingClips = async () => {
    const { data, error } = await supabase
      .from('video_clips')
      .select('*')
      .eq('video_id', video.id)
      .order('start_time', { ascending: true });

    if (!error && data) {
      setGeneratedClips(data);
    }
  };

  const autoGenerateClips = () => {
    const newClips: ClipSegment[] = [];
    let currentTime = 0;

    while (currentTime < video.duration) {
      const duration = Math.min(clipDuration, video.duration - currentTime);
      newClips.push({
        start: currentTime,
        duration: duration,
        title: `Clip ${newClips.length + 1}`,
      });
      currentTime += duration;
    }

    setClips(newClips);
  };

  const addClip = () => {
    const currentTime = videoRef.current?.currentTime || 0;
    const duration = Math.min(clipDuration, video.duration - currentTime);

    setClips([
      ...clips,
      {
        start: currentTime,
        duration: duration,
        title: `Clip ${clips.length + 1}`,
      },
    ]);
  };

  const removeClip = (index: number) => {
    setClips(clips.filter((_, i) => i !== index));
  };

  const generateClips = async () => {
    if (clips.length === 0) {
      alert('Please add some clips first');
      return;
    }

    setGenerating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const clipPromises = clips.map(async (clip) => {
        const { error } = await supabase
          .from('video_clips')
          .insert({
            video_id: video.id,
            title: clip.title,
            file_path: video.file_path,
            start_time: clip.start,
            duration: clip.duration,
          });

        if (error) throw error;
      });

      await Promise.all(clipPromises);
      await loadExistingClips();
      setClips([]);
      alert('Clips created successfully!');
    } catch (err) {
      console.error('Error generating clips:', err);
      alert('Failed to generate clips. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadClip = (clip: VideoClip) => {
    const url = `${videoUrl}#t=${clip.start_time},${clip.start_time + clip.duration}`;
    window.open(url, '_blank');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Create Video Clips</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">{video.title}</h3>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg bg-black"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-gray-700 mb-3">Clip Settings</h4>
                <div className="mb-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    Clip Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={clipDuration}
                    onChange={(e) => setClipDuration(Number(e.target.value))}
                    min="5"
                    max="60"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={autoGenerateClips}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                  >
                    <Scissors className="w-4 h-4 mr-2" />
                    Auto Generate
                  </button>
                  <button
                    onClick={addClip}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Clip
                  </button>
                </div>
              </div>

              {clips.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Pending Clips ({clips.length})</h4>
                  <div className="space-y-2 mb-4">
                    {clips.map((clip, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1">
                          <input
                            type="text"
                            value={clip.title}
                            onChange={(e) => {
                              const newClips = [...clips];
                              newClips[index].title = e.target.value;
                              setClips(newClips);
                            }}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(clip.start)} - {formatTime(clip.start + clip.duration)}
                          </p>
                        </div>
                        <button
                          onClick={() => removeClip(index)}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={generateClips}
                    disabled={generating}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 font-semibold"
                  >
                    {generating ? 'Creating Clips...' : `Create ${clips.length} Clips`}
                  </button>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-3">
                Generated Clips ({generatedClips.length})
              </h4>
              {generatedClips.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Scissors className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No clips generated yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {generatedClips.map((clip) => (
                    <div
                      key={clip.id}
                      className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-800">{clip.title}</h5>
                          <p className="text-sm text-gray-500">
                            {formatTime(clip.start_time)} - {formatTime(clip.start_time + clip.duration)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Duration: {formatTime(clip.duration)}
                          </p>
                        </div>
                        <button
                          onClick={() => downloadClip(clip)}
                          className="ml-2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
