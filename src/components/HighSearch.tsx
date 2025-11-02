import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { HallticketChip } from './HallticketChip';
import { Badge } from './ui/badge';

export interface SearchResult {
  hallticket: string;
  name: string;
  room?: string;
  hostel?: string;
  phone?: string;
  status?: string;
  gatePassId?: string;
}

interface HighSearchProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onSelect?: (result: SearchResult) => void;
  results?: SearchResult[];
  loading?: boolean;
  className?: string;
}

export function HighSearch({
  placeholder = 'Search by Hallticket, Name, Room...',
  onSearch,
  onSelect,
  results = [],
  loading = false,
  className = ''
}: HighSearchProps) {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query && onSearch) {
        onSearch(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleSelect = (result: SearchResult) => {
    onSelect?.(result);
    setQuery('');
    setShowResults(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {showResults && query && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          )}
          {!loading && results.map((result, idx) => (
            <button
              key={idx}
              onClick={() => handleSelect(result)}
              className="w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors border-b border-border last:border-b-0"
            >
              <div className="flex-1 text-left">
                <HallticketChip hallticket={result.hallticket} name={result.name} />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {result.room && (
                    <Badge variant="secondary">{result.room}</Badge>
                  )}
                  {result.hostel && (
                    <Badge variant="secondary">{result.hostel}</Badge>
                  )}
                  {result.status && (
                    <Badge variant="outline">{result.status}</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
