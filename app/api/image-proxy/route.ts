import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL параметр обязателен' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Ошибка при получении изображения: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type');
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Ошибка прокси-изображения:', error);
    return NextResponse.json(
      { error: 'Ошибка при обработке изображения' },
      { status: 500 }
    );
  }
} 