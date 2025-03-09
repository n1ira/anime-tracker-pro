import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { settingsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const settings = await db.select().from(settingsTable).limit(1);

    if (settings.length === 0) {
      // Initialize settings if they don't exist
      const newSettings = await db
        .insert(settingsTable)
        .values({
          openaiApiKey: '',
          useSystemEnvVar: false,
        })
        .returning();

      return NextResponse.json(newSettings[0]);
    }

    return NextResponse.json(settings[0]);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { openaiApiKey, useSystemEnvVar } = body;

    // Get the current settings
    const currentSettings = await db.select().from(settingsTable).limit(1);

    if (currentSettings.length === 0) {
      // Initialize settings if they don't exist
      const newSettings = await db
        .insert(settingsTable)
        .values({
          openaiApiKey,
          useSystemEnvVar,
        })
        .returning();

      return NextResponse.json(newSettings[0]);
    }

    // Update existing settings
    const updatedSettings = await db
      .update(settingsTable)
      .set({
        openaiApiKey,
        useSystemEnvVar,
        updatedAt: new Date(),
      })
      .where(eq(settingsTable.id, currentSettings[0].id))
      .returning();

    return NextResponse.json(updatedSettings[0]);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
