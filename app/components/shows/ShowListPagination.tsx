import React from 'react';
import { Button } from '@/app/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ShowListPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ShowListPagination({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: ShowListPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }
  
  return (
    <div className="flex justify-center items-center space-x-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      
      <div className="text-sm">
        Page {currentPage} of {totalPages}
      </div>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
} 