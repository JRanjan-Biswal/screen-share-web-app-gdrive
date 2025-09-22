import { NextRequest, NextResponse } from 'next/server';
import { FFmpegVideoEditor, VideoEditOptions } from '@/lib/ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { writeFile, mkdir } from 'fs/promises';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('google_token')?.value;
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    const editOptions: VideoEditOptions = await request.json();
    
    // Create temp directory
    const tempDir = path.join(process.cwd(), 'temp', id);
    await mkdir(tempDir, { recursive: true });

    const editor = new FFmpegVideoEditor(tempDir);
    
    // Download original video
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!downloadResponse.ok) {
      throw new Error('Failed to download video from Google Drive');
    }

    const videoBuffer = await downloadResponse.arrayBuffer();
    const inputPath = path.join(tempDir, 'input.webm');
    await writeFile(inputPath, Buffer.from(videoBuffer));

    // Get video info
    const videoInfo = await editor.getVideoInfo(inputPath);
    console.log('Video info:', videoInfo);

    // Process video with FFmpeg
    const outputPath = path.join(tempDir, 'output.mp4');
    await editor.processVideo(inputPath, outputPath, editOptions);

    // Upload processed video back to Google Drive
    const processedVideoBuffer = await fs.readFile(outputPath);
    
    // Create metadata for the new file
    const metadata = {
      name: `edited_${Date.now()}.mp4`,
      parents: ['1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'] // Replace with your folder ID
    };

    // Upload to Google Drive
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: createMultipartBody(metadata, processedVideoBuffer)
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`Failed to upload processed video: ${error}`);
    }

    const uploadResult = await uploadResponse.json();

    // Clean up temp files
    await editor.cleanup([inputPath, outputPath]);

    return NextResponse.json({
      success: true,
      message: 'Video processed successfully',
      videoId: uploadResult.id,
      videoInfo: videoInfo
    });

  } catch (error) {
    console.error('Video processing failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Video processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function createMultipartBody(metadata: { name: string; parents: string[] }, fileBuffer: Buffer): FormData {
  const formData = new FormData();
  
  // Add metadata part
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  
  // Add file part
  formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: 'video/mp4' }), 'video.mp4');
  
  return formData;
}

// Get video info endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = request.cookies.get('google_token')?.value;
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated' 
      }, { status: 401 });
    }

    // Download video temporarily to get info
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!downloadResponse.ok) {
      throw new Error('Failed to download video from Google Drive');
    }

    const videoBuffer = await downloadResponse.arrayBuffer();
    const tempDir = path.join(process.cwd(), 'temp', id);
    await mkdir(tempDir, { recursive: true });
    
    const inputPath = path.join(tempDir, 'temp_video.webm');
    await writeFile(inputPath, Buffer.from(videoBuffer));

    const editor = new FFmpegVideoEditor();
    const videoInfo = await editor.getVideoInfo(inputPath);

    // Clean up temp file
    await editor.cleanup([inputPath]);

    return NextResponse.json({
      success: true,
      videoInfo: videoInfo
    });

  } catch (error) {
    console.error('Failed to get video info:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get video info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
