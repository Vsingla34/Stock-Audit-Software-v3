      // src/components/locations/LocationMaster.tsx
      import { useState, useEffect } from "react";
      import { useInventory } from "@/context/InventoryContext";
      import { useCompany } from "@/context/CompanyContext";
      import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
      import { Button } from "@/components/ui/button";
      import { Building, Plus } from "lucide-react";
      import { toast } from "sonner";
      import {
        Table,
        TableBody,
        TableCell,
        TableHead,
        TableHeader,
        TableRow,
      } from "@/components/ui/table";
      import { LocationForm } from "./LocationForm";
      import { LocationRow } from "./LocationRow";
      import { LocationEditRow } from "./LocationEditRow";
      import {
        isLocationNameDuplicate,
        getLocationItemCount,
      } from "./utils/locationUtils";
      import type { Location } from "@/context/InventoryContext";
      import { useUserAccess } from "@/hooks/useUserAccess";
      import { supabase } from "@/integrations/supabase/client";

      interface Company {
        id: string;
        name: string;
      }

      export const LocationMaster = () => {
        const { locations, addLocation, updateLocation, deleteLocation, itemMaster } =
          useInventory();
        const { userRole } = useUserAccess();
        const { selectedCompanyId } = useCompany();

        const [isAdding, setIsAdding] = useState(false);
        const [isEditing, setIsEditing] = useState<string | null>(null);
        const [editLocation, setEditLocation] = useState<Location | null>(null);

        const [currentCompanyName, setCurrentCompanyName] = useState<string | null>(
          null
        );
        const [companyLoaded, setCompanyLoaded] = useState(false);

        const [companies, setCompanies] = useState<Company[]>([]);

        // Load all companies so we can map companyId -> name for each location row
        useEffect(() => {
          const fetchCompanies = async () => {
            try {
              const { data, error } = await supabase
                .from("companies")
                .select("id, name")
                .eq("is_active", true)
                .order("name");

              if (error) throw error;
              setCompanies(data || []);
            } catch (err) {
              console.error("Error fetching companies for locations:", err);
              toast.error("Failed to load companies");
            }
          };

          fetchCompanies();
        }, []);

        // Load just the currently selected company's name for the header text
        useEffect(() => {
          const fetchCurrentCompanyName = async () => {
            if (!selectedCompanyId) {
              setCurrentCompanyName(null);
              setCompanyLoaded(true);
              return;
            }
            try {
              const { data, error } = await supabase
                .from("companies")
                .select("name")
                .eq("id", selectedCompanyId)
                .single();

              if (error) throw error;
              setCurrentCompanyName(data?.name ?? null);
            } catch (err) {
              console.error("Error fetching current company name:", err);
              setCurrentCompanyName(null);
            } finally {
              setCompanyLoaded(true);
            }
          };

          setCompanyLoaded(false);
          fetchCurrentCompanyName();
        }, [selectedCompanyId]);

        const handleAddLocation = async (newLocation: Omit<Location, "id">) => {
          try {
            await addLocation(newLocation);
            setIsAdding(false);
            toast.success("Location added successfully");
          } catch (error) {
            console.error(error);
            toast.error("Failed to add location");
          }
        };

        const handleUpdateLocation = async (location: Location) => {
          if (!location.name.trim()) {
            toast.error("Location name is required");
            return;
          }

          if (isLocationNameDuplicate(locations, location.name, location.id)) {
            toast.error("A location with this name already exists");
            return;
          }

          try {
            await updateLocation(location);
            setIsEditing(null);
            setEditLocation(null);
            toast.success("Location updated successfully");
          } catch (error) {
            console.error(error);
            toast.error("Failed to update location");
          }
        };

        const handleDeleteLocation = async (id: string) => {
          try {
            await deleteLocation(id);
            toast.success("Location deleted successfully");
          } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to delete location");
          }
        };

        const startEditing = (location: Location) => {
          setIsEditing(location.id);
          setEditLocation({ ...location });
        };

        const cancelEditing = () => {
          setIsEditing(null);
          setEditLocation(null);
        };

        const getCompanyName = (companyId?: string) => {
          if (!companyId) return "-";
          const company = companies.find((c) => c.id === companyId);
          return company?.name ?? "-";
        };

        const isAuditor = userRole === "auditor";

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  <span>Location Master</span>
                </div>

                {!isAuditor && !isAdding && (
                  <Button
                    onClick={() => setIsAdding(true)}
                    size="sm"
                    className="h-8"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add Location
                  </Button>
                )}
              </CardTitle>

              {/* No visible loading text – only show once we know */}
              {companyLoaded && (
                <p className="text-xs text-muted-foreground mt-1">
                  {currentCompanyName ? (
                    <>
                      Current company:{" "}
                      <span className="font-medium">{currentCompanyName}</span>
                    </>
                  ) : (
                    "No company selected"
                  )}
                </p>
              )}
            </CardHeader>

            <CardContent>
              {isAuditor ? (
                <div className="text-sm text-muted-foreground">
                  Location management (creating, editing and viewing full location
                  master) is restricted to Admin and Client users.
                  <br />
                  You can still access the{" "}
                  <span className="font-medium">Location Audit Summary</span> and
                  perform audits for assigned locations.
                </div>
              ) : (
                <>
                  {isAdding && (
                    <LocationForm
                      locations={locations}
                      onSave={handleAddLocation}
                      onCancel={() => setIsAdding(false)}
                    />
                  )}

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Items</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {locations.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center py-4 text-muted-foreground"
                            >
                              No locations found. Add a location to get started.
                            </TableCell>
                          </TableRow>
                        ) : (
                          locations.map((location) =>
                            isEditing === location.id && editLocation ? (
                              <LocationEditRow
                                key={location.id}
                                location={editLocation}
                                companyName={getCompanyName(location.companyId)}
                                itemCount={getLocationItemCount(
                                  itemMaster,
                                  location.name
                                )}
                                onSave={handleUpdateLocation}
                                onCancel={cancelEditing}
                              />
                            ) : (
                              <LocationRow
                                key={location.id}
                                location={location}
                                companyName={getCompanyName(location.companyId)}
                                itemCount={getLocationItemCount(
                                  itemMaster,
                                  location.name
                                )}
                                onEdit={startEditing}
                                onDelete={handleDeleteLocation}
                              />
                            )
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      };
