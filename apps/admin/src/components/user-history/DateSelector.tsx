"use client";

import { CalendarIcon, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Toolbar, ToolbarActions, ToolbarMain } from "@/components/console";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateSelectorProps {
  tempDate: Date | undefined;
  onTempDateChange: (date: Date | undefined) => void;
  loading: boolean;
  onSearch: () => void;
}

export function DateSelector({
  tempDate,
  onTempDateChange,
  loading,
  onSearch,
}: DateSelectorProps) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-4">
      <Toolbar>
        <ToolbarMain>
          <label
            htmlFor="date"
            className="shrink-0 text-sm font-medium text-foreground"
          >
            Select date
          </label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant="outline"
                className={cn(
                  "h-9 w-full justify-start text-left font-normal sm:w-60",
                  !tempDate && "text-muted-foreground",
                )}
                disabled={loading}
              >
                <CalendarIcon className="size-4" strokeWidth={2} />
                <span className="truncate">
                  {tempDate ? format(tempDate, "PPP") : "Pick a date"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={tempDate}
                onSelect={onTempDateChange}
                disabled={(date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </ToolbarMain>
        <ToolbarActions>
          <Button
            className="h-9"
            onClick={onSearch}
            disabled={loading || !tempDate}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Searching
              </>
            ) : (
              <>
                <Search className="size-4" strokeWidth={2} />
                Search
              </>
            )}
          </Button>
        </ToolbarActions>
      </Toolbar>
    </div>
  );
}
