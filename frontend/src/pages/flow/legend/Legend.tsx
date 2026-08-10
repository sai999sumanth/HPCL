interface LegendItem {
  color: string;
  label: string;
}

const legendItems: LegendItem[] = [
  { color: "#808080", label: "Total" },
  { color: "#1ce918", label: "Operational" },
  { color: "#ff8000", label: "Maintenance" },
  { color: "#ff0000", label: "Faulty" },
];

const Legend: React.FC = () => {
  return (
    <div className="flex flex-col items-start px-4 py-1">
      <h3 className="font-semibold text-gray-700 text-md mb-2">Legend</h3>
      {legendItems.map(({ color, label }) => (
        <div key={label} className="flex items-center space-x-2">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: color }}
          ></div>
          <span className="text-sm text-gray-600 text-md">{label}</span>
        </div>
      ))}
    </div>
  );
};

export default Legend;
