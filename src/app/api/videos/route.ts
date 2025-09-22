import { NextRequest, NextResponse } from 'next/server';

const RECORDING_FOLDER_NAME = 'Screen Recordings';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('google_token')?.value;
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    // First, find the recording folder
    const folderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${RECORDING_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const folderData = await folderResponse.json();
    
    if (!folderData.files || folderData.files.length === 0) {
      return NextResponse.json({ 
        success: true, 
        videos: [] 
      });
    }

    const folderId = folderData.files[0].id;

    // Get videos from the folder
    const videosResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,createdTime,size,webViewLink,thumbnailLink,mimeType,videoMediaMetadata(durationMillis))&x=createdTime desc`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const videosData = await videosResponse.json();

    console.log('Videos data:', videosData);

    if (!videosResponse.ok) {
      throw new Error(videosData.error?.message || 'Failed to fetch videos');
    }

    const videos = videosData.files.map((file: { id: string; name: string; createdTime: string; size?: string; webViewLink?: string; thumbnailLink?: string; mimeType?: string }) => ({
      id: file.id,
      name: file.name,
      createdTime: file.createdTime,
      size: file.size || '0',
      webViewLink: file.webViewLink,
      thumbnailLink: file.thumbnailLink,
      mimeType: file.mimeType,
    }));

    return NextResponse.json({ 
      success: true, 
      videos 
    });
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch videos' 
    }, { status: 500 });
  }
}
