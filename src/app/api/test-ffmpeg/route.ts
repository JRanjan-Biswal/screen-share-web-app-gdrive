import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import ffmpegStatic from 'ffmpeg-static';

export async function GET() {
  try {
    // Test if FFmpeg is available
    if (!ffmpegStatic) {
      return NextResponse.json({
        success: false,
        error: 'FFmpeg not found',
        message: 'ffmpeg-static package is not available'
      }, { status: 500 });
    }

    // Test FFmpeg version
    const execAsync = promisify(exec);

    try {
      const { stdout } = await execAsync(`"${ffmpegStatic}" -version`);
      const versionMatch = stdout.match(/ffmpeg version ([^\s]+)/);
      const version = versionMatch ? versionMatch[1] : 'unknown';

      return NextResponse.json({
        success: true,
        message: 'FFmpeg is working',
        ffmpegPath: ffmpegStatic,
        version: version
      });
    } catch (execError) {
      return NextResponse.json({
        success: false,
        error: 'FFmpeg execution failed',
        details: execError instanceof Error ? execError.message : 'Unknown error',
        ffmpegPath: ffmpegStatic
      }, { status: 500 });
    }

  } catch (error) {
    console.error('FFmpeg test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'FFmpeg test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
