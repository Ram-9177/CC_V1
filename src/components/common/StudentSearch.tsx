import React, { useState } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/useCommon';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
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
  };
  college_code?: string;
}

interface StudentSearchProps {
  onSelect: (userId: string) => void;
  placeholder?: string;
  className?: string;
}

export function StudentSearch({ onSelect, placeholder = 'Search student...', className }: StudentSearchProps) {
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
            "flex w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-2.5 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer hover:border-primary/50 transition-all duration-300",
            className
          )}
          onClick={() => setOpen((prev) => !prev)}
        >
          {selectedStudent ? (
              <div className="flex items-center gap-2 truncate">
                  <span className="font-medium">{selectedStudent.user.name}</span>
                  <span className="text-muted-foreground text-xs">({selectedStudent.user.hall_ticket || selectedStudent.user.username})</span>
              </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          
          {selectedStudent ? (
              <X className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100" onClick={clearSelection} />
          ) : (
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-xl animate-in zoom-in-95 fade-in-0 duration-200" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search by name or reg no..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && (
                <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                </div>
            )}
            {!isLoading && query && students.length === 0 && (
                <CommandEmpty>No students found.</CommandEmpty>
            )}
            {!isLoading && students.map((student) => (
              <CommandItem
                key={student.id}
                value={student.id.toString()}
                onSelect={() => handleSelect(student)}
                className="cursor-pointer"
              >
                <div className="flex flex-col w-full pointer-events-none">
                    <div className="flex justify-between items-center w-full">
                        <span className="font-medium">{student.user.name}</span>
                        <span className="text-xs text-muted-foreground">{student.college_code}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {student.user.hall_ticket || student.user.username}
                    </span>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
