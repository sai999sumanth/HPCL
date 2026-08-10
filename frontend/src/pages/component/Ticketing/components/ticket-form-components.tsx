import React from "react";

export const SectionWrapper: React.FC<{
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className }) => (
  <div className={`py-3 border-t first:border-t-0 ${className}`}>
    <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider px-1">
      {title}
    </h3>
    {children}
  </div>
);

export const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  required?: boolean;
}> = ({ label, children, required }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
      {label}
      {required && <span className="text-red-500 ml-0.5 text-xl font-bold align-middle leading-none" title="Required">*</span>}
    </label>
    {children}
  </div>
);

export const FieldRow: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-3 last:mb-0 ${
      className ?? ""
    }`}
  >
    {children}
  </div>
);

export const resolveLocationId = (
  plants: { id: string; name: string }[],
  initialData: any
): string => {
  if (!initialData) return "";

  // Handle location_id - could be string or array
  if (initialData.location_id) {
    if (Array.isArray(initialData.location_id)) {
      // If it's an array, try to find the first matching plant
      for (const locId of initialData.location_id) {
        const plantExists = plants.find((p) => p.id === locId);
        if (plantExists) return locId;
      }
    } else {
      // Single location_id
      const plantExists = plants.find((p) => p.id === initialData.location_id);
      if (plantExists) return initialData.location_id;
    }
  }

  // Handle location_name - could be string or array
  if (initialData.location_name) {
    const locationNames = Array.isArray(initialData.location_name)
      ? initialData.location_name
      : [initialData.location_name];

    // Try to find a match for any of the location names
    for (const locationName of locationNames) {
      if (!locationName) continue;

      // Try exact match first
      let plantByName = plants.find(
        (p) => p.name === locationName
      );
      if (plantByName) return plantByName.id;

      // Try case-insensitive match
      plantByName = plants.find(
        (p) => p.name?.toLowerCase() === locationName?.toLowerCase()
      );
      if (plantByName) return plantByName.id;

      // Try partial match (contains)
      plantByName = plants.find(
        (p) => p.name?.toLowerCase().includes(locationName?.toLowerCase()) ||
               locationName?.toLowerCase().includes(p.name?.toLowerCase())
      );
      if (plantByName) return plantByName.id;
    }

    console.log("Could not find plant match for:", initialData.location_name);
    console.log("Available plants:", plants.map(p => ({ id: p.id, name: p.name })));
  }

  return "";
};

