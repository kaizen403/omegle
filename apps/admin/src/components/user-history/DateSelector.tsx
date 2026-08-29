"use client";

import { motion } from "framer-motion";
import { CalendarIcon, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 sm:mb-6 flex items-start gap-2 sm:gap-3"
    >
      <div className="flex flex-col gap-2 sm:gap-3 w-full">
        <label
          htmlFor="date"
          className="text-slate-600 text-sm sm:text-base font-medium"
        >
          📅 Select Date
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full sm:w-64 justify-start text-left font-normal bg-white border-sky-200 hover:bg-sky-50 text-slate-900",
                  !tempDate && "text-muted-foreground",
                )}
                disabled={loading}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {tempDate ? format(tempDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white border-sky-200">
              <Calendar
                mode="single"
                selected={tempDate}
                onSelect={onTempDateChange}
                disabled={(date) =>
                  date > new Date() || date < new Date("1900-01-01")
                }
                initialFocus
                className="bg-sky-50"
              />
            </PopoverContent>
          </Popover>
          <Button
            onClick={onSearch}
            disabled={loading || !tempDate}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
