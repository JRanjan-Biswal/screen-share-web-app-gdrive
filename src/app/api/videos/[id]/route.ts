import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('google_token')?.value;
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const fileId = (await params).id;

    // Get file metadata from Google Drive
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,size,createdTime,modifiedTime,mimeType,videoMediaMetadata(durationMillis)`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ 
          success: false, 
          error: 'Video not found' 
        }, { status: 404 });
      }
      throw new Error('Failed to fetch file metadata');
    }

    const fileData = await response.json();
    
    // Convert to our Video interface
    const video = {
      id: fileData.id,
      name: fileData.name,
      size: parseInt(fileData.size || '0'),
      createdTime: fileData.createdTime,
      modifiedTime: fileData.modifiedTime,
      mimeType: fileData.mimeType,
      downloadUrl: `/api/videos/${fileData.id}/download`,
      durationInMs: fileData?.videoMediaMetadata?.durationMillis
    };

    return NextResponse.json({ 
      success: true, 
      video 
    });
  } catch (error) {
    console.error('Failed to fetch video:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch video' 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.cookies.get('google_token')?.value;
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const fileId = (await params).id;

    // Delete file from Google Drive
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to delete file');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Video deleted successfully' 
    });
  } catch (error) {
    console.error('Failed to delete video:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to delete video' 
    }, { status: 500 });
  }
}
