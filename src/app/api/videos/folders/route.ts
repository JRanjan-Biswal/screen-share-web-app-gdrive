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

    // Find the recording folder
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
        folderId: null,
        folderName: RECORDING_FOLDER_NAME
      });
    }

    const folderId = folderData.files[0].id;

    return NextResponse.json({
      success: true,
      folderId: folderId,
      folderName: RECORDING_FOLDER_NAME
    });

  } catch (error) {
    console.error('Failed to get folder:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get folder',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
