/** Standard height for text inputs, native selects, and searchable select triggers (40px). */
export const FIELD_HEIGHT = "h-10";

export const fieldControlBase =
  `border border-slate-200 rounded-lg px-3 ${FIELD_HEIGHT} w-full text-sm outline-none transition-all ` +
  `focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 ` +
  `placeholder:text-slate-400 text-slate-900 bg-white ` +
  `disabled:bg-slate-50 disabled:cursor-not-allowed`;

export const fieldControlError =
  "border-red-400 focus:ring-2 focus:ring-red-400/20 focus:border-red-400";

/** Native `<select>`: hide browser arrow and reserve space for the field chevron icon. */
export const fieldNativeSelectClasses =
  "appearance-none pr-9 cursor-pointer bg-white";

/** Searchable select trigger (country, state, bank, etc.). */
export const fieldSelectTriggerBase =
  `flex items-center gap-2 w-full border rounded-lg px-3 ${FIELD_HEIGHT} text-sm text-left ` +
  `focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 ` +
  `transition-colors bg-white disabled:bg-slate-50 disabled:cursor-not-allowed`;

/** Dropdown list option row. */
export const fieldDropdownOption =
  "flex items-center w-full px-3 min-h-10 text-sm text-left hover:bg-teal-50 hover:text-teal-700 transition-colors";

export const fieldDropdownSearch =
  `w-full px-2.5 ${FIELD_HEIGHT} text-sm border border-slate-200 rounded-md ` +
  `focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600`;
