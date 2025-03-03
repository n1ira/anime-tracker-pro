import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { showsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const show = await db.select().from(showsTable).where(eq(showsTable.id, id));
    
    if (show.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    return NextResponse.json(show[0]);
  } catch (error) {
    console.error('Error fetching show:', error);
    return NextResponse.json({ error: 'Failed to fetch show' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();
    
    const updatedShow = await db.update(showsTable)
      .set(body)
      .where(eq(showsTable.id, id))
      .returning();
    
    if (updatedShow.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    return NextResponse.json(updatedShow[0]);
  } catch (error) {
    console.error('Error updating show:', error);
    return NextResponse.json({ error: 'Failed to update show' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    const deletedShow = await db.delete(showsTable)
      .where(eq(showsTable.id, id))
      .returning();
    
    if (deletedShow.length === 0) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Show deleted successfully' });
  } catch (error) {
    console.error('Error deleting show:', error);
    return NextResponse.json({ error: 'Failed to delete show' }, { status: 500 });
  }
} 