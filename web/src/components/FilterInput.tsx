import { useState, useRef, useEffect } from "react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export default function FilterInput({
  label,
  value,
  options,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(value.toLowerCase()),
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <input
        className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 w-44"
        placeholder={`Filter ${label}...`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto text-sm">
          {value && (
            <li
              className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-gray-400 italic"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear filter
            </li>
          )}
          {filtered.map((o) => (
            <li
              key={o}
              className={`px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer ${
                o === value
                  ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium"
                  : ""
              }`}
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
            >
              {highlightMatch(o, value)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold underline">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}
