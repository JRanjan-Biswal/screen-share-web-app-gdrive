import { NextRequest, NextResponse } from 'next/server';

const RECORDING_FOLDER_NAME = 'Screen Recordings';

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
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;
    const folderId = formData.get('folderId') as string;

    if (!file || !fileName) {
      return NextResponse.json({ 
        success: false, 
        error: 'File and fileName are required' 
      }, { status: 400 });
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Create metadata for the new file
    const metadata = {
      name: fileName,
      parents: folderId ? [folderId] : []
    };

    // Create multipart body
    const boundary = '----formdata-boundary-' + Math.random().toString(36);
    const body = createMultipartBody(metadata, fileBuffer, boundary);

    // Upload to Google Drive
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: body
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('Upload error:', error);
      throw new Error(`Failed to upload video: ${error}`);
    }

    const uploadResult = await uploadResponse.json();

    return NextResponse.json({
      success: true,
      message: 'Video uploaded successfully',
      fileId: uploadResult.id,
      fileName: uploadResult.name,
      webViewLink: `https://drive.google.com/file/d/${uploadResult.id}/view`
    });

  } catch (error) {
    console.error('Upload failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function createMultipartBody(metadata: { name: string; parents: string[] }, fileBuffer: Buffer, boundary: string): Buffer {
  const metadataPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n`
  );

  const filePart = Buffer.concat([
    Buffer.from(`--${boundary}\r\n`),
    Buffer.from(`Content-Type: video/mp4\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`)
  ]);

  return Buffer.concat([metadataPart, filePart]);
}
