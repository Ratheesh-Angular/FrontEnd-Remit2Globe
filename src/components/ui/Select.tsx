import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  hint,
  options,
  placeholder,
  required,
  className,
  id,
  ...props
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      <select
        id={selectId}
        required={required}
        className={cn(
          "border border-slate-200 rounded-lg px-3 h-10 text-sm w-full bg-white appearance-none",
          "outline-none transition-all cursor-pointer",
          "focus:ring-2 focus:ring-primary focus:border-primary",
          "text-slate-900",
          "disabled:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400",
          error && "border-danger focus:ring-danger focus:border-danger",
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-slate-400">{hint}</p>}
    </div>
  );
}
