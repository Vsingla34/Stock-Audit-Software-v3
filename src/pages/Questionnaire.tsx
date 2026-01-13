import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUserAccess } from "@/hooks/useUserAccess";
import { QuestionList } from "@/components/questionnaire/QuestionList";
import { QuestionnaireForm } from "@/components/questionnaire/QuestionnaireForm";
import { QuestionnaireResponses } from "@/components/questionnaire/QuestionnaireResponses";
import { LocationSelector } from "@/components/upload/LocationSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInventory } from "@/context/InventoryContext";

const Questionnaire = () => {
  const { userRole, accessibleLocations } = useUserAccess();
  const { locations, assignments } = useInventory();
  
  const canManageQuestions = userRole === "admin" || userRole === "super_admin";
  const isClient = userRole === "client";

  const [activeTab, setActiveTab] = useState(isClient ? "responses" : "management");
  const [selectedLocation, setSelectedLocation] = useState("default");
  const [responseLocation, setResponseLocation] = useState("default");
  
  const userLocations = accessibleLocations();

  useEffect(() => {
    if (isClient && activeTab === "management") {
      setActiveTab("responses");
    }
  }, [isClient, activeTab]);

  const locationName = selectedLocation && selectedLocation !== "default" 
    ? locations.find(loc => loc.id === selectedLocation)?.name
    : "";

  const responseLocationName = responseLocation && responseLocation !== "default" 
    ? locations.find(loc => loc.id === responseLocation)?.name
    : "";

  const getActiveAssignmentId = (locId: string): number | undefined => {
      if (!locId || locId === 'default') return undefined;
      const assignment = assignments.find(a => 
         a.locationId === locId && 
         (a.status === 'active' || a.status === 'pending' || a.status === 'submitted')
      );
      return assignment?.id;
  };
  
  const activeAssignmentId = getActiveAssignmentId(selectedLocation);
  
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">Questionnaire</h1>
          <p className="text-gray-500">
            {canManageQuestions 
              ? "Manage audit questionnaires and view responses" 
              : isClient 
                ? "View audit responses for your locations"
                : "Complete audit questionnaires for your locations"
            }
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-[400px] bg-gray-100">
            <TabsTrigger 
              value="management" 
              disabled={isClient} 
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
            >
              {canManageQuestions ? "Manage Questions" : "Answer Questions"}
            </TabsTrigger>
            <TabsTrigger 
              value="responses" 
              disabled={!userRole}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm"
            >
              View Responses
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="management" className="space-y-6 mt-6">
            {!isClient && (
              canManageQuestions ? (
                <QuestionList />
              ) : (
                <div className="space-y-6">
                  <div className="max-w-md">
                    {userLocations.length > 0 && (
                      <LocationSelector
                        locations={userLocations}
                        selectedLocation={selectedLocation}
                        onLocationChange={setSelectedLocation}
                        placeholder="Select a location to audit"
                      />
                    )}
                  </div>
                  
                  {selectedLocation && selectedLocation !== "default" ? (
                    activeAssignmentId ? (
                        <QuestionnaireForm 
                          locationId={selectedLocation} 
                          assignmentId={activeAssignmentId}
                          locationName={locationName}
                        />
                    ) : (
                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200">
                            No active assignment found for this location. Please start an audit assignment first.
                        </div>
                    )
                  ) : (
                    <p className="text-gray-500">Please select a location to view and answer questions</p>
                  )}
                </div>
              )
            )}
          </TabsContent>
          
          <TabsContent value="responses" className="space-y-6 mt-6">
            <div className="space-y-6">
              <div className="max-w-md">
                <LocationSelector
                  locations={canManageQuestions ? locations : userLocations}
                  selectedLocation={responseLocation}
                  onLocationChange={setResponseLocation}
                  placeholder="Select a location to view"
                />
              </div>
              
              {responseLocation && responseLocation !== "default" ? (
                <QuestionnaireResponses 
                  locationId={responseLocation}
                  locationName={responseLocationName || ""}
                />
              ) : (
                <p className="text-gray-500">Please select a location to view responses</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Questionnaire;