import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check if user has a valid session/token
    // In a real implementation, you'd check JWT tokens or session storage
    const token = request.cookies.get('google_token')?.value;
    
    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    // Verify token with Google
    const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?access_token=' + token);
    
    if (response.ok) {
      const userInfo = await response.json();
      return NextResponse.json({ 
        authenticated: true, 
        user: userInfo 
      });
    } else {
      return NextResponse.json({ authenticated: false });
    }
  } catch (error) {
    console.error('Auth status check failed:', error);
    return NextResponse.json({ authenticated: false });
  }
}
