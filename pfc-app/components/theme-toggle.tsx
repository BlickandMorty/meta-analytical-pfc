'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon, MonitorIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const CYCLE: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycle = () => {
    const current = theme as string;
    const idx = CYCLE.indexOf(current as 'light' | 'dark' | 'system');
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setTheme(next);
  };

  const label = !mounted ? '' : theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light';

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={cycle}
          >
            {!mounted ? (
              <span className="h-4 w-4" />
            ) : theme === 'dark' ? (
              <MoonIcon className="h-4 w-4" />
            ) : theme === 'system' ? (
              <MonitorIcon className="h-4 w-4" />
            ) : (
              <SunIcon className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
