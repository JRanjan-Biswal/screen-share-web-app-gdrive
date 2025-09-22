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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [shareEmails, setShareEmails] = useState<string[]>(['']);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  console.log(videos);

  const handleDelete = async (video: Video) => {
    if (window.confirm(`Are you sure you want to delete "${video.name}"?`)) {
      setDeletingId(video.id);
      await onVideoDelete(video.id);
      setDeletingId(null);
    }
  };

  const handleCopyLink = async (video: Video) => {
    try {
      await navigator.clipboard.writeText(video.webViewLink);
      setCopiedId(video.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = video.webViewLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedId(video.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleShare = (video: Video) => {
    setSelectedVideo(video);
    setShareEmails(['']);
    setShareResult({ type: null, message: '' });
    setShowShareModal(true);
  };

  const handleShareSubmit = async () => {
    if (!selectedVideo) return;

    const validEmails = shareEmails.filter(email => email.trim() !== '');
    if (validEmails.length === 0) {
      setShareResult({ type: 'error', message: 'Please enter at least one email address' });
      return;
    }

    setSharing(true);
    setShareResult({ type: null, message: '' });

    try {
      const response = await fetch(`/api/videos/${selectedVideo.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emails: validEmails,
          role: 'reader'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShareResult({ type: 'success', message: data.message });
        setTimeout(() => {
          setShowShareModal(false);
          setShareResult({ type: null, message: '' });
        }, 2000);
      } else {
        setShareResult({ type: 'error', message: data.error || 'Failed to share video' });
      }
    } catch (error) {
      console.error('Share failed:', error);
      setShareResult({ type: 'error', message: 'Failed to share video' });
    } finally {
      setSharing(false);
    }
  };

  const addEmailField = () => {
    setShareEmails([...shareEmails, '']);
  };

  const removeEmailField = (index: number) => {
    if (shareEmails.length > 1) {
      setShareEmails(shareEmails.filter((_, i) => i !== index));
    }
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...shareEmails];
    newEmails[index] = value;
    setShareEmails(newEmails);
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
              
              <div className="space-y-2">
                {/* Primary Actions Row */}
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
                </div>

                {/* Secondary Actions Row */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyLink(video)}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition duration-200 flex items-center justify-center gap-1 ${
                      copiedId === video.id
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                    }`}
                  >
                    {copiedId === video.id ? (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleShare(video)}
                    className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-2 rounded text-sm font-medium transition duration-200 flex items-center justify-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    Share
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
          </div>
        ))}
      </div>

      {/* Share Modal */}
      {showShareModal && selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-t-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Share Video</h3>
                    <p className="text-purple-100 text-sm">{selectedVideo.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="w-8 h-8 bg-gray-800 bg-opacity-80 hover:bg-opacity-100 rounded-full flex items-center justify-center transition duration-200 border border-gray-700"
                >
                  <span className="text-white text-xl font-bold">×</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Email Input Fields */}
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-gray-800">
                  Share with people
                </label>
                <div className="space-y-3">
                  {shareEmails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="Enter email address"
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition duration-200 bg-white text-gray-900 placeholder-gray-500"
                      />
                      {shareEmails.length > 1 && (
                        <button
                          onClick={() => removeEmailField(index)}
                          className="px-3 py-3 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition duration-200"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={addEmailField}
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium transition duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add another email
                </button>
              </div>

              {/* Permission Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Permission Level</div>
                    <div className="text-sm text-gray-500">Viewer - Can view and download</div>
                  </div>
                </div>
              </div>

              {/* Status Messages */}
              {shareResult.type && (
                <div className={`p-4 rounded-xl border-2 ${
                  shareResult.type === 'success' 
                    ? 'bg-green-50 border-green-200 text-green-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      shareResult.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      <span className="text-white text-sm">
                        {shareResult.type === 'success' ? '✓' : '✕'}
                      </span>
                    </div>
                    <div className="text-sm font-medium">
                      {shareResult.message}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 px-6 py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleShareSubmit}
                  disabled={sharing}
                  className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-xl transition duration-200 font-medium flex items-center justify-center gap-2"
                >
                  {sharing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Sharing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                      </svg>
                      Share Video
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
