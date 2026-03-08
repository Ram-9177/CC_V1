import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/useCommon';
import { cn } from '@/lib/utils';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Student {
  id: number; // Tenant ID
  user: {
    id: number; // User ID
    name: string;
    username: string; // Reg No
    hall_ticket?: string;
    phone?: string;
    phone_number?: string;
  };
  college_code?: string;
  city?: string;
  is_allocated?: boolean;
  room_number?: string;
}

interface StudentSearchProps {
  onSelect: (userId: string) => void;
  placeholder?: string;
  className?: string;
  excludeAllocated?: boolean;
}

export function StudentSearch({ onSelect, placeholder = 'Search student...', className, excludeAllocated = false }: StudentSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['student-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return { results: [] };
      const res = await api.get(`/users/tenants/?search=${debouncedQuery}`);
      return res.data;
    },
    enabled: debouncedQuery.length > 0,
  });

  const students: Student[] = data?.results || [];

  const handleSelect = (student: Student) => {
    if (excludeAllocated && student.is_allocated) return;
    
    setSelectedStudent(student);
    onSelect(student.user.id.toString());
    setOpen(false);
    setQuery('');
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStudent(null);
    onSelect('');
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-2.5 text-sm shadow-sm ring-offset-background placeholder:text-stone-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer hover:border-primary/50 transition-all duration-300",
            open ? "border-primary ring-2 ring-primary/10" : "",
            className
          )}
          onClick={() => setOpen((prev) => !prev)}
        >
          {selectedStudent ? (
              <div className="flex items-center gap-2 truncate">
                  <span className="font-medium text-black">{selectedStudent.user.name}</span>
                  <span className="text-muted-foreground text-xs">({selectedStudent.user.hall_ticket || selectedStudent.user.username})</span>
              </div>
          ) : (
            <span className="text-stone-400 font-medium">{placeholder}</span>
          )}
          
          {selectedStudent ? (
              <X className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100" onClick={clearSelection} />
          ) : (
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl animate-in zoom-in-95 fade-in-0 duration-200 mt-1" align="start">
        <Command shouldFilter={false} className="bg-transparent">
          <div className="flex items-center border-b border-border px-3 bg-muted/30">
             <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
             <CommandInput 
               placeholder="Type to search..." 
               value={query}
               onValueChange={setQuery}
               className="border-none focus:ring-0 h-10 bg-transparent flex-1"
             />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto p-1">
            {isLoading && (
              <div className="bg-muted/30">
                <BrandedLoading compact message="Searching database..." />
              </div>
            )}
            {!isLoading && query && students.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">No students found.</div>
            )}
            {!isLoading && students.map((student) => {
              const isDisabled = excludeAllocated && student.is_allocated;
              
              return (
              <CommandItem
                key={student.id}
                value={student.id.toString()}
                onSelect={() => handleSelect(student)}
                disabled={isDisabled}
                className={cn(
                    "rounded-lg px-3 py-2 transition-colors",
                    isDisabled ? "opacity-60 cursor-not-allowed grayscale-[0.5]" : "cursor-pointer hover:bg-primary/10"
                )}
              >
                <div className="flex flex-col w-full">
                    <div className="flex justify-between items-center w-full">
                        <span className={cn("font-bold text-sm", isDisabled ? "text-muted-foreground" : "text-black")}>
                            {student.user.name}
                        </span>
                        {student.is_allocated ? (
                            <span className="text-[10px] font-black bg-black text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                Room {student.room_number}
                            </span>
                        ) : (
                            <span className="text-xs text-primary font-bold">{student.college_code}</span>
                        )}
                    </div>
                    <div className="flex justify-between items-center w-full mt-1">
                        <span className="text-[11px] text-muted-foreground font-mono">
                            {student.user.hall_ticket || student.user.username}
                        </span>
                        <span className="text-[10px] text-muted-foreground italic">
                            {student.user.phone || student.user.phone_number || '—'}
                        </span>
                    </div>
                    {student.is_allocated && (
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-red-500 font-bold uppercase tracking-widest">
                            <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse"></span>
                            Already Allocated
                        </div>
                    )}
                </div>
              </CommandItem>
            )})}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
