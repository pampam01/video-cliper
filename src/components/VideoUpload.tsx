import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface VideoUploadProps {
  onUploadComplete: () => void;
}

export function VideoUpload({ onUploadComplete }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    const maxSizeMb = 500;
    if (file.size / (1024 * 1024) > maxSizeMb) {
      setError(`Video is too large. Please upload a file smaller than ${maxSizeMb}MB.`);
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in to upload videos');
        setUploading(false);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onerror = () => {
        setError('Failed to read video metadata. Please try another file.');
        setUploading(false);
      };

      video.onloadedmetadata = async () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;

        const { error: dbError } = await supabase
          .from('videos')
          .insert({
            user_id: user.id,
            title: file.name,
            file_path: fileName,
            duration: duration,
            status: 'completed',
          });

        if (dbError) throw dbError;

        setProgress(100);
        setTimeout(() => {
          setUploading(false);
          onUploadComplete();
        }, 500);
      };

      video.src = URL.createObjectURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload video. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Video</h2>
          <p className="text-gray-600">Upload your long video to create short clips</p>
        </div>

        <label
          htmlFor="video-upload"
          className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            uploading
              ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
              : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <>
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-sm text-gray-600">Uploading... {progress}%</p>
              </>
            ) : (
              <>
                <Upload className="w-12 h-12 text-blue-500 mb-4" />
                <p className="mb-2 text-sm text-gray-700">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">MP4, MOV, AVI, or other video formats</p>
              </>
            )}
          </div>
          <input
            id="video-upload"
            type="file"
            className="hidden"
            accept="video/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
