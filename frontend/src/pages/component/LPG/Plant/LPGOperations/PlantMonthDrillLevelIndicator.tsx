/** Drill level indicator when scope is Zone (Zone vs Plant) */
export function PlantMonthDrillLevelIndicator({ level }: { level: 0 | 1 }) {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
      <span className="font-medium text-gray-700">Drill level:</span>
      <span className={level === 0 ? "font-bold text-blue-600" : "text-gray-500"}>Zone</span>
      <span className="text-gray-400">→</span>
      <span className={level === 1 ? "font-bold text-blue-600" : "text-gray-500"}>Plant</span>
      <div className="flex gap-1 ml-0.5" aria-hidden>
        <div className={`w-2 h-2 rounded-full ${level === 0 ? "bg-blue-600" : "bg-gray-300"}`} />
        <div className={`w-2 h-2 rounded-full ${level === 1 ? "bg-blue-600" : "bg-gray-300"}`} />
      </div>
    </div>
  );
}
