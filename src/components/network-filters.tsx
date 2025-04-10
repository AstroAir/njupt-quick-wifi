"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecurityType } from "@/types";
import { useWifiStore } from "@/store";
import { Search, ArrowUpDown, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";

export function NetworkFilters() {
  const {
    searchQuery,
    securityFilter,
    sortBy,
    sortDirection,
    showOnlySaved,
    showOnlyAvailable,
    setSearchQuery,
    setSecurityFilter,
    setSortBy,
    setSortDirection,
    setShowOnlySaved,
    setShowOnlyAvailable,
    resetFilters,
  } = useWifiStore();

  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Update the store when the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearchQuery, setSearchQuery]);

  // Update local state when store changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  return (
    <motion.div className="bg-muted/40 p-4 rounded-lg space-y-4" layout>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <Label htmlFor="search-networks">Search Networks</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-networks"
              placeholder="Search by name..."
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="security-filter">Security Type</Label>
          <Select
            value={securityFilter || ""}
            onValueChange={(value) =>
              setSecurityFilter(value ? (value as SecurityType) : null)
            }
          >
            <SelectTrigger id="security-filter" className="w-full sm:w-[180px]">
              <SelectValue placeholder="Any security" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any security</SelectItem>
              <SelectItem value={SecurityType.OPEN}>Open</SelectItem>
              <SelectItem value={SecurityType.WEP}>WEP</SelectItem>
              <SelectItem value={SecurityType.WPA}>WPA</SelectItem>
              <SelectItem value={SecurityType.WPA2}>WPA2</SelectItem>
              <SelectItem value={SecurityType.WPA2_ENTERPRISE}>
                WPA2 Enterprise
              </SelectItem>
              <SelectItem value={SecurityType.WPA3}>WPA3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="space-y-2 flex-1">
          <Label htmlFor="sort-by">Sort By</Label>
          <Select
            value={sortBy}
            onValueChange={(value) =>
              setSortBy(value as "signal" | "name" | "security")
            }
          >
            <SelectTrigger id="sort-by">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="signal">Signal Strength</SelectItem>
              <SelectItem value="name">Network Name</SelectItem>
              <SelectItem value="security">Security Type</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sort-direction">Direction</Label>
          <Button
            id="sort-direction"
            variant="outline"
            className="w-full sm:w-[180px]"
            onClick={() =>
              setSortDirection(sortDirection === "asc" ? "desc" : "asc")
            }
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortDirection === "asc" ? "Ascending" : "Descending"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-2">
        <div className="flex items-center space-x-2">
          <Switch
            id="show-saved"
            checked={showOnlySaved}
            onCheckedChange={setShowOnlySaved}
          />
          <Label htmlFor="show-saved">Show only saved networks</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="show-available"
            checked={showOnlyAvailable}
            onCheckedChange={setShowOnlyAvailable}
          />
          <Label htmlFor="show-available">Show only available networks</Label>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
      </div>
    </motion.div>
  );
}
