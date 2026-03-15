import { cn } from '@/lib/utils';

interface MaterialIconProps {
  name: string;
  size?: number;
  className?: string;
  filled?: boolean;
}

export function MaterialIcon({ name, size = 20, className, filled = false }: MaterialIconProps) {
  return (
    <span
      className={cn('material-symbols-outlined select-none', className)}
      style={{
        fontSize: size,
        fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
      }}
    >
      {name}
    </span>
  );
}
