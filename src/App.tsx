import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { VideoUpload } from './components/VideoUpload';
import { VideoList } from './components/VideoList';
import { ClipCreator } from './components/ClipCreator';
import { LogOut, Upload as UploadIcon } from 'lucide-react';
import type { Video } from './lib/supabase';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    setRefreshKey((prev) => prev + 1);
  };

  const handleVideoSelect = (video: Video) => {
    setSelectedVideo(video);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth onAuthSuccess={checkUser} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-800">Video Clip Maker</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
              >
                <UploadIcon className="w-4 h-4 mr-2" />
                Upload Video
              </button>
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-800 transition-colors flex items-center"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {showUpload ? (
          <VideoUpload onUploadComplete={handleUploadComplete} />
        ) : (
          <>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">My Videos</h2>
              <p className="text-gray-600">Upload and transform your videos into short clips</p>
            </div>
            <VideoList onVideoSelect={handleVideoSelect} refresh={refreshKey} />
          </>
        )}
      </main>

      {selectedVideo && (
        <ClipCreator
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  );
}

export default App;
