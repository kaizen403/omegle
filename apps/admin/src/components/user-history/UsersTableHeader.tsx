"use client";

import { Th } from "@/components/console";

export function UsersTableHeader() {
  return (
    <thead>
      <tr>
        <Th className="hidden sm:table-cell" width="3.5rem" align="right">
          #
        </Th>
        <Th>User</Th>
        <Th className="hidden lg:table-cell" width="7rem">
          UID
        </Th>
        <Th className="hidden sm:table-cell" width="7rem">
          Gender
        </Th>
        <Th className="hidden sm:table-cell" width="10rem">
          Time
        </Th>
        <Th className="hidden lg:table-cell" width="12rem">
          Location
        </Th>
        <Th align="right" width="8rem">
          Actions
        </Th>
      </tr>
    </thead>
  );
}
