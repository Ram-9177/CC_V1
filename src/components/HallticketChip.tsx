import React from 'react';

interface HallticketChipProps {
  hallticket: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function HallticketChip({ hallticket, name, size = 'md', className = '' }: HallticketChipProps) {
  const sizeClasses = {
    sm: 'gap-1',
    md: 'gap-1.5',
    lg: 'gap-2'
  };

  return (
    <div className={`inline-flex items-center ${sizeClasses[size]} ${className}`}>
      <span className="text-foreground">{hallticket}</span>
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">{name}</span>
    </div>
  );
}
