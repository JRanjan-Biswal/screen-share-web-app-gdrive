import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

export async function POST(request: NextRequest) {
  try {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')}&` +
      `response_type=code&` +
      `access_type=offline&` +
      `prompt=consent`;

    return NextResponse.json({ 
      success: true, 
      authUrl 
    });
  } catch (error) {
    console.error('Failed to generate auth URL:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to initiate authentication' 
    }, { status: 500 });
  }
}
