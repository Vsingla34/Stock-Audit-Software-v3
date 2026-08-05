import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATIC_COLUMNS = [
  "SKU", "Name", "Category", "Location",
  "Sys Qty", "Phy Qty", "Var", "Status", "Last Audited", "Remarks",
];
const ROW_COUNT = 8;

export const InventoryTableSkeleton = () => (
  <div className="space-y-4">
    {/* Search bar skeleton */}
    <div className="flex items-center gap-2">
      <Skeleton className="h-9 w-64 rounded-md" />
    </div>

    <div className="rounded-md border bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {STATIC_COLUMNS.map((col) => (
              <TableHead key={col}>
                <Skeleton className="h-4 w-16" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: ROW_COUNT }).map((_, rowIdx) => (
            <TableRow key={rowIdx} className="hover:bg-transparent">
              {/* SKU */}
              <TableCell><Skeleton className="h-3.5 w-20" /></TableCell>
              {/* Name */}
              <TableCell><Skeleton className="h-3.5 w-40" /></TableCell>
              {/* Category — pill shape */}
              <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
              {/* Location */}
              <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
              {/* Sys Qty */}
              <TableCell className="text-center"><Skeleton className="h-3.5 w-8 mx-auto" /></TableCell>
              {/* Phy Qty */}
              <TableCell className="text-center"><Skeleton className="h-3.5 w-8 mx-auto" /></TableCell>
              {/* Var */}
              <TableCell className="text-center"><Skeleton className="h-3.5 w-8 mx-auto" /></TableCell>
              {/* Status — badge shape */}
              <TableCell className="text-center">
                <Skeleton className="h-5 w-20 rounded-full mx-auto" />
              </TableCell>
              {/* Last Audited */}
              <TableCell><Skeleton className="h-3.5 w-28" /></TableCell>
              {/* Remarks */}
              <TableCell><Skeleton className="h-3.5 w-24" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Footer row */}
      <div className="flex items-center justify-between px-4 py-2 border-t">
        <Skeleton className="h-3.5 w-32" />
      </div>
    </div>
  </div>
);