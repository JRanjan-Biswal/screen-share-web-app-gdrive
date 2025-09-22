'use client';

import { useState } from 'react';
import { Video } from '@/types/video';
import Image from 'next/image';
import Link from 'next/link';

interface VideoListProps {
  videos: Video[];
  onVideoDelete: (videoId: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function VideoList({ 
  videos, 
  onVideoDelete, 
  onRefresh, 
  loading 
}: VideoListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  console.log(videos);

  const handleDelete = async (video: Video) => {
    if (window.confirm(`Are you sure you want to delete "${video.name}"?`)) {
      setDeletingId(video.id);
      await onVideoDelete(video.id);
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: string) => {
    const size = parseInt(bytes);
    if (size === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-4xl">🎥</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No videos found</h3>
        <p className="text-gray-500 mb-6">
          Start recording with the browser extension to see your videos here.
        </p>
        <button
          onClick={onRefresh}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition duration-200"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">
          Your Recordings ({videos.length})
        </h2>
        <button
          onClick={onRefresh}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition duration-200 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <div
            key={video.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition duration-200"
          >
            <div className="aspect-video bg-gray-100 flex items-center justify-center">
              {video.thumbnailLink ? (
                <Image
                  src={video.thumbnailLink}
                  alt={video.name}
                  width={100}
                  height={100}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <p className="text-sm">No preview</p>
                </div>
              )}
            </div>
            
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                {video.name}
              </h3>
              
              <div className="text-sm text-gray-500 space-y-1 mb-4">
                <p>Size: {formatFileSize(video.size)}</p>
                <p>Created: {formatDate(video.createdTime)}</p>
              </div>
              
              <div className="flex gap-2">
                <Link
                  href={`/edit/${video.id}`}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-sm font-medium transition duration-200 text-center"
                >
                  Edit
                </Link>
                
                <button
                  onClick={() => window.open(video.webViewLink, '_blank')}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium transition duration-200"
                >
                  View
                </button>
                
                <button
                  onClick={() => handleDelete(video)}
                  disabled={deletingId === video.id}
                  className="bg-red-100 hover:bg-red-200 disabled:bg-red-50 text-red-700 px-3 py-2 rounded text-sm font-medium transition duration-200"
                >
                  {deletingId === video.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-700"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
