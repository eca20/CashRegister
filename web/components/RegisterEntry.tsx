import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { amountText } from "../entry";
import type { AmountField, Amounts, EntryKey } from "../entry";

interface Props {
  amounts: Amounts;
  active: AmountField;
  currency: string;
  busy: boolean;
  onActive: (field: AmountField) => void;
  onKey: (key: EntryKey, replace?: boolean) => void;
  onPaste: (field: AmountField, text: string) => void;
}

export function RegisterEntry({
  amounts,
  active,
  currency,
  busy,
  onActive,
  onKey,
  onPaste,
}: Props) {
  const owedInput = useRef<HTMLInputElement>(null);
  const paidInput = useRef<HTMLInputElement>(null);

  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let key: EntryKey | undefined;
    if (/^\d$/.test(event.key)) key = event.key as EntryKey;
    else if (event.key === "Backspace") key = "backspace";
    else if (event.key === "Delete" || event.key === "Escape") key = "clear";
    if (key !== undefined) {
      event.preventDefault();
      const input = event.currentTarget;
      const allSelected =
        input.selectionStart === 0 && input.selectionEnd === input.value.length;
      onKey(allSelected && key === "backspace" ? "clear" : key, allSelected);
      requestAnimationFrame(() =>
        input.setSelectionRange(input.value.length, input.value.length),
      );
    } else if (event.key === "Enter" && active === "owed") {
      event.preventDefault();
      paidInput.current?.focus();
    }
  }

  return (
    <>
      <div className="amounts">
        {(["owed", "paid"] as const).map((field) => (
          <div
            className={`amount-field ${active === field ? "is-active" : ""}`}
            key={field}
          >
            <label htmlFor={`amount-${field}`}>
              <span className="display-led" aria-hidden="true" />
              Amount {field}
              <span className="display-currency">{currency}</span>
            </label>
            <input
              ref={field === "owed" ? owedInput : paidInput}
              id={`amount-${field}`}
              aria-label={`Amount ${field}`}
              readOnly
              inputMode="none"
              value={amountText(amounts[field])}
              data-long={amountText(amounts[field]).length > 8}
              aria-describedby="keypad-help"
              disabled={busy}
              onFocus={() => onActive(field)}
              onKeyDown={keyboard}
              onPaste={(event) => {
                event.preventDefault();
                onPaste(field, event.clipboardData.getData("text"));
              }}
            />
          </div>
        ))}
      </div>
      <div className="entry-guide">
        <p id="keypad-help">
          Enter cents: <kbd>213</kbd> becomes <strong>2.13</strong>. Use the
          keypad or your keyboard.
        </p>
        <span className="active-label">Entering {active}</span>
      </div>
      <div className="keypad" role="group" aria-label="Money keypad">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "00"].map(
          (digit) => (
            <button
              key={digit}
              type="button"
              className="key numeric-key"
              onClick={() => onKey(digit as EntryKey)}
              aria-label={digit}
            >
              {digit}
            </button>
          ),
        )}
        <button
          type="button"
          className="key backspace-key"
          aria-label="Backspace"
          onClick={() => onKey("backspace")}
        >
          <span aria-hidden="true">⌫</span>
          <span className="key-subtitle">BACKSPACE</span>
        </button>
        <button
          type="button"
          className="key clear-key"
          aria-label="Clear active amount"
          onClick={() => onKey("clear")}
        >
          C<span className="key-subtitle">CLEAR {active.toUpperCase()}</span>
        </button>
        <button
          type="button"
          className="key field-key"
          onClick={() =>
            (active === "owed" ? paidInput : owedInput).current?.focus()
          }
        >
          {active === "owed" ? "Amount paid" : "Amount owed"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}
