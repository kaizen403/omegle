"use client";

import { RefreshCw } from "lucide-react";
import {
  Toolbar,
  ToolbarMain,
  ToolbarActions,
  SearchField,
} from "@/components/console";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  onRefresh,
}: SearchBarProps) {
  return (
    <Toolbar>
      <ToolbarMain>
        <SearchField
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search rooms, names or ids"
        />
      </ToolbarMain>
      <ToolbarActions>
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          className="h-9"
          title="Refresh"
        >
          <RefreshCw className="size-4" strokeWidth={2} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </ToolbarActions>
    </Toolbar>
  );
}
