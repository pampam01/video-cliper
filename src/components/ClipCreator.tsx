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
  const [exportingClipId, setExportingClipId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');

  useEffect(() => {
    loadVideoUrl();
    loadExistingClips();
  }, [video]);

  const loadVideoUrl = async () => {
    try {
      const { data, error } = supabase.storage
        .from('videos')
        .getPublicUrl(video.file_path);

      if (error) throw error;

      setVideoUrl(data.publicUrl);
    } catch (error) {
      console.error('Failed to load video URL', error);
      setErrorMessage('Gagal memuat video. Periksa koneksi atau konfigurasi storage.');
    }
  };

  const loadExistingClips = async () => {
    const { data, error } = await supabase
      .from('video_clips')
      .select('*')
      .eq('video_id', video.id)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error loading clips:', error);
      setErrorMessage('Tidak bisa memuat klip yang sudah dibuat.');
      return;
    }

    setGeneratedClips(data || []);
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

    if (clips.some((clip) => clip.duration <= 0)) {
      alert('Clip duration must be greater than 0 seconds');
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

  const exportPortraitClip = async (clip: VideoClip) => {
    if (!videoUrl) {
      setErrorMessage('Video belum siap diekspor.');
      return;
    }

    if (typeof window.MediaRecorder === 'undefined') {
      setErrorMessage('Browser tidak mendukung MediaRecorder untuk ekspor 9:16.');
      return;
    }

    setErrorMessage(null);

    try {
      setExportingClipId(clip.id);

      const sourceVideo = document.createElement('video');
      sourceVideo.src = videoUrl;
      sourceVideo.crossOrigin = 'anonymous';
      sourceVideo.muted = false;
      sourceVideo.volume = 0;
      sourceVideo.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        sourceVideo.onloadedmetadata = () => resolve();
        sourceVideo.onerror = () => reject(new Error('Failed to load video for export'));
      });

      sourceVideo.currentTime = clip.start_time;
      await new Promise<void>((resolve) => {
        sourceVideo.onseeked = () => resolve();
      });

      if (!sourceVideo.captureStream) {
        throw new Error('Browser tidak mendukung captureStream pada elemen video.');
      }

      const canvas = document.createElement('canvas');
      // 9:16 aspect ratio for TikTok/Reels/Shorts
      canvas.width = 720;
      canvas.height = 1280;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas is not supported in this browser');

      const canvasStream = canvas.captureStream();
      const sourceStream = sourceVideo.captureStream();
      const audioTracks = sourceStream.getAudioTracks();

      const composedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracks,
      ]);

      const preferredMimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];

      const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));

      if (!mimeType) {
        throw new Error('Format video/webm tidak didukung oleh browser ini.');
      }

      const recorder = new MediaRecorder(composedStream, {
        mimeType,
      });
      const chunks: BlobPart[] = [];
      let recordingStopped = false;

      const drawFrame = () => {
        if (recordingStopped || recorder.state === 'inactive') return;

        const sourceRatio = sourceVideo.videoWidth / sourceVideo.videoHeight;
        const targetRatio = canvas.width / canvas.height;

        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        let offsetX = 0;
        let offsetY = 0;

        if (sourceRatio > targetRatio) {
          drawHeight = canvas.height;
          drawWidth = sourceVideo.videoWidth * (drawHeight / sourceVideo.videoHeight);
          offsetX = -(drawWidth - canvas.width) / 2;
        } else {
          drawWidth = canvas.width;
          drawHeight = sourceVideo.videoHeight * (drawWidth / sourceVideo.videoWidth);
          offsetY = -(drawHeight - canvas.height) / 2;
        }

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceVideo, offsetX, offsetY, drawWidth, drawHeight);
        requestAnimationFrame(drawFrame);
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const stopRecording = () => {
        if (recordingStopped) return;
        recordingStopped = true;
        recorder.stop();
        composedStream.getTracks().forEach((track) => track.stop());
        sourceStream.getTracks().forEach((track) => track.stop());
        sourceVideo.pause();
      };

      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = (event) => reject(event.error || new Error('Failed to export clip'));
      });

      recorder.start();
      await sourceVideo.play();
      requestAnimationFrame(drawFrame);

      setTimeout(stopRecording, clip.duration * 1000);

      const blob = await recordingPromise;
      stopRecording();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${clip.title.replace(/\s+/g, '-').toLowerCase()}-portrait.webm`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Failed to export clip', error);
      setErrorMessage('Gagal membuat video potrait. Coba lagi di browser lain jika masalah berlanjut.');
    } finally {
      setExportingClipId(null);
    }
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
              {errorMessage && (
                <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}
              <p className="text-sm text-gray-600 mb-3">
                Ekspor setiap klip langsung ke format vertikal 9:16 yang cocok untuk TikTok, Instagram Reels, atau YouTube Shorts.
              </p>
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
                        <div className="flex gap-2 ml-2">
                          <button
                            onClick={() => downloadClip(clip)}
                            className="bg-gray-100 text-gray-800 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => exportPortraitClip(clip)}
                            disabled={exportingClipId === clip.id}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                          >
                            {exportingClipId === clip.id ? 'Membuat 9:16...' : 'Ekspor 9:16'}
                          </button>
                        </div>
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
