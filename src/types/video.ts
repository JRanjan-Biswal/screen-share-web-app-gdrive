export interface Video {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  webViewLink: string;
  thumbnailLink?: string;
  duration?: number;
  durationInMs?: number;
  mimeType?: string;
}

export interface VideoEditOptions {
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  speed: number;
  quality: 'low' | 'medium' | 'high';
}

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
}
