import { cn } from "@/lib/utils";
import { FIELD_HEIGHT } from "@/lib/field-styles";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  required,
  className,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
          {required && <span className="text-danger ml-1">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          required={required}
          className={cn(
            `border border-slate-200 rounded-lg px-3 ${FIELD_HEIGHT} text-sm w-full bg-white`,
            "outline-none transition-all",
            "focus:ring-2 focus:ring-primary focus:border-primary",
            "placeholder:text-slate-400 text-slate-900",
            "disabled:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400",
            error && "border-danger focus:ring-danger focus:border-danger",
            leftIcon && "pl-9",
            rightIcon && "pr-9",
            className,
          )}
          {...props}
        />

        {rightIcon && (
          <span className="absolute right-3 text-slate-400 pointer-events-none flex items-center">
            {rightIcon}
          </span>
        )}
      </div>

      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-sm text-slate-400">{hint}</p>}
    </div>
  );
}
