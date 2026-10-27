import { useState } from "react";
import { toLocalDigits, toPlus60, isValidMyPhone } from "../../lib/phone";

// THE phone box. Every phone input in the app is this one component, so every
// box follows one rule (src/lib/phone.js): a fixed "+60" the user cannot edit,
// and whatever they type or paste after it is cleaned to the local digits.
// Typing the whole number (0123456789, +60 12-345 6789) does not count the 60
// or the 0 twice, and nothing past the longest real Malaysian number is kept.
//
// onChange gets the "+60..." form, or "" when the box is empty.
// className / style dress the outer box (the look of the surface's own inputs);
// prefix* and input* dress the two parts. The box turns red once the user has
// left it with a number that cannot be real; forms still check isValidMyPhone
// before saving.
export default function PhoneInput({
  value,
  onChange,
  mobileOnly = false,
  className,
  style,
  prefixClassName,
  prefixStyle,
  inputClassName,
  inputStyle,
  invalidColor = "#dc2626",
  onBlur,
  ...rest
}) {
  const [touched, setTouched] = useState(false);
  const local = toLocalDigits(value);
  const invalid = touched && local !== "" && !isValidMyPhone(local, { mobileOnly });

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        padding: 0,
        ...style,
        ...(invalid ? { borderColor: invalidColor } : null),
      }}
    >
      <span
        className={prefixClassName}
        style={prefixClassName ? prefixStyle : { padding: "0 4px 0 12px", opacity: prefixStyle?.color ? 1 : 0.6, flexShrink: 0, whiteSpace: "nowrap", userSelect: "none", ...prefixStyle }}
        aria-hidden="true"
      >
        +60
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="12 345 6789"
        {...rest}
        value={local}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange?.(toPlus60(e.target.value))}
        onBlur={(e) => { setTouched(true); onBlur?.(e); }}
        className={inputClassName}
        style={inputClassName ? inputStyle : {
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "inherit",
          font: "inherit",
          padding: "10px 12px 10px 4px",
          ...inputStyle,
        }}
      />
    </div>
  );
}
