interface Props {
  value: string; // "" means "now", otherwise "YYYY-MM-DD"
  onChange: (value: string) => void;
}

export default function DatePicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500">As of:</label>
      <input
        type="date"
        className="border rounded px-2 py-1 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          className="text-xs text-blue-600 hover:text-blue-800"
          onClick={() => onChange("")}
        >
          Now
        </button>
      )}
      {!value && (
        <span className="text-xs text-gray-400 italic">latest</span>
      )}
    </div>
  );
}
