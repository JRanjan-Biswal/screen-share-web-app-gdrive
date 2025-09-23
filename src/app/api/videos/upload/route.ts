import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('google_token')?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;
    const fileName = formData.get('fileName') as string;
    const folderId = formData.get('folderId') as string;

    if (!file || !fileName || !folderId) {
      return NextResponse.json({
        success: false,
        error: 'Missing file, fileName, or folderId'
      }, { status: 400 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: token });

    const drive = google.drive({ version: 'v3', auth });

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'video/mp4',
      },
      media: {
        mimeType: 'video/mp4',
        body: fileBuffer,
      },
      fields: 'id,webViewLink',
    });

    if (response.status === 200 && response.data.id) {
      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: response.statusText || 'Failed to upload file to Google Drive'
      }, { status: response.status });
    }

  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to upload file to Google Drive',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
