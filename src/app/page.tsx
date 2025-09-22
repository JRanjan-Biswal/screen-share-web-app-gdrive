'use client';

import { useState, useEffect } from 'react';
import VideoList from '@/components/VideoList';
import GoogleAuth from '@/components/GoogleAuth';
import { Video } from '@/types/video';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
      
      if (data.authenticated) {
        await loadVideos();
      }
    } catch (error) {
      console.error('Failed to check authentication:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/videos');
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.videos);
      } else {
        console.error('Failed to load videos:', data.error);
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoDelete = async (videoId: string) => {
    try {
      const response = await fetch(`/api/videos/${videoId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setVideos(videos.filter(v => v.id !== videoId));
      } else {
        console.error('Failed to delete video');
      }
    } catch (error) {
      console.error('Failed to delete video:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <GoogleAuth onAuthenticated={checkAuthentication} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🎥 Video Manager
          </h1>
          <p className="text-gray-600">
            Manage and edit your screen recordings from Google Drive
          </p>
        </header>

        <VideoList
          videos={videos}
          onVideoDelete={handleVideoDelete}
          onRefresh={loadVideos}
          loading={loading}
        />
      </div>
    </div>
  );
}