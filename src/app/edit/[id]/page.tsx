'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import VideoEditor from '@/components/VideoEditor';
import GoogleAuth from '@/components/GoogleAuth';
import { Video } from '@/types/video';

interface EditPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditPage({ params }: EditPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      setAuthLoading(true);
      const response = await fetch('/api/auth/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
      
      if (data.authenticated) {
        await loadVideo();
      }
    } catch (error) {
      console.error('Failed to check authentication:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadVideo = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/videos/${id}`);
      const data = await response.json();
      
      if (data.success && data.video) {
        console.log('Video data:', data);
        setVideo(data.video);
      } else {
        console.error('Failed to load video:', data.error);
        // Redirect to home if video not found
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to load video:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleEditComplete = () => {
    // Redirect back to home page after editing is complete
    router.push('/');
  };

  const handleCancel = () => {
    // Redirect back to home page when canceling
    router.push('/');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Video Editor</h1>
            <p className="text-gray-600">Please sign in to edit videos</p>
          </div>
          <GoogleAuth onAuthenticated={checkAuthentication} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading video...</p>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Video Not Found</h1>
          <p className="text-gray-600 mb-6">The video you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to access it.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg transition duration-200"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <VideoEditor
          video={video}
          onComplete={handleEditComplete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
