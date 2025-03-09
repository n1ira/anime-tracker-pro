import React from 'react';
import { Button } from '@/app/components/ui/button';
import { Loader2, Save } from 'lucide-react';

interface SubmitHandlerProps {
  isEditing: boolean;
  loading: boolean;
  error: string | null;
}

export function SubmitHandler({ isEditing, loading, error }: SubmitHandlerProps) {
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isEditing ? 'Updating...' : 'Creating...'}
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            {isEditing ? 'Update Show' : 'Create Show'}
          </>
        )}
      </Button>
    </div>
  );
}
