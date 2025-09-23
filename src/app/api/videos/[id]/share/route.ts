import { NextRequest, NextResponse } from 'next/server';

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

    const { emails, role = 'reader' } = await request.json();
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'At least one email address is required' 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid email addresses: ${invalidEmails.join(', ')}` 
      }, { status: 400 });
    }

    // Get file permissions
    const permissionsResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}/permissions`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!permissionsResponse.ok) {
      throw new Error('Failed to get file permissions');
    }

    const permissionsData = await permissionsResponse.json();
    const existingPermissions = permissionsData.permissions || [];

    // Share with each email
    const shareResults = [];
    for (const email of emails) {
      try {
    // Check if already shared with this email
    const alreadyShared = existingPermissions.some(
      (perm: { emailAddress?: string }) => perm.emailAddress === email
    );

        if (alreadyShared) {
          shareResults.push({
            email,
            success: true,
            message: 'Already shared with this email'
          });
          continue;
        }

        // Share the file
        const shareResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${id}/permissions`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              role: role,
              type: 'user',
              emailAddress: email,
            }),
          }
        );

        if (shareResponse.ok) {
          shareResults.push({
            email,
            success: true,
            message: 'Successfully shared'
          });
        } else {
          const errorData = await shareResponse.json();
          shareResults.push({
            email,
            success: false,
            message: errorData.error?.message || 'Failed to share'
          });
        }
      } catch {
        shareResults.push({
          email,
          success: false,
          message: 'Error sharing with this email'
        });
      }
    }

    const successCount = shareResults.filter(r => r.success).length;
    const totalCount = shareResults.length;

    return NextResponse.json({
      success: successCount > 0,
      message: `Successfully shared with ${successCount} of ${totalCount} email(s)`,
      results: shareResults
    });

  } catch (error) {
    console.error('Share video failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to share video',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
