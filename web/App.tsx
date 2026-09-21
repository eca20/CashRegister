import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { MAX_INPUT_BYTES } from "../src/limits.js";
import { amountText, enterCents, pastedCents } from "./entry";
import type { AmountField, Amounts, EntryKey } from "./entry";
import { RegisterEntry } from "./components/RegisterEntry";
import { BatchEntry } from "./components/BatchEntry";
import { Receipt } from "./components/Receipt";
import type { ReceiptData } from "./components/Receipt";
import { useRegisterSound } from "./useRegisterSound";

type Mode = "register" | "batch";
const SAMPLE = "2.12,3.00\n1.97,2.00\n3.33,5.00";

export function App() {
  const [mode, setMode] = useState<Mode>("register");
  const [amounts, setAmounts] = useState<Amounts>({ owed: 0, paid: 0 });
  const [active, setActive] = useState<AmountField>("owed");
  const [input, setInput] = useState(SAMPLE);
  const [fileName, setFileName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [divisor, setDivisor] = useState("3");
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const revision = useRef(0);
  const registerTab = useRef<HTMLButtonElement>(null);
  const batchTab = useRef<HTMLButtonElement>(null);
  const sound = useRegisterSound();
  const locked = busy || loadingFile;

  function changed() {
    revision.current++;
    setReceipt(null);
    setError("");
  }

  function edit(key: EntryKey, replace = false) {
    if (locked) return;
    changed();
    try {
      const next = enterCents(replace ? 0 : amounts[active], key);
      setAmounts({ ...amounts, [active]: next });
      sound.play("key");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to enter amount.",
      );
    }
  }

  function paste(field: AmountField, text: string) {
    if (locked) return;
    changed();
    try {
      setAmounts({ ...amounts, [field]: pastedCents(text) });
      sound.play("key");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Unable to paste amount.",
      );
    }
  }

  function selectMode(next: Mode) {
    if (locked || mode === next) return;
    changed();
    setMode(next);
    sound.play("key");
  }

  function tabKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    let next: Mode;
    if (event.key === "Home") next = "register";
    else if (event.key === "End") next = "batch";
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight")
      next = mode === "register" ? "batch" : "register";
    else return;
    event.preventDefault();
    selectMode(next);
    (next === "register" ? registerTab : batchTab).current?.focus();
  }

  async function loadFile(file: File | undefined) {
    if (!file || locked) return;
    changed();
    const current = revision.current;
    if (file.size > MAX_INPUT_BYTES) {
      setError("Choose a file no larger than 1 MiB.");
      return;
    }
    setLoadingFile(true);
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        await file.arrayBuffer(),
      );
      if (current !== revision.current) return;
      setInput(text);
      setFileName(file.name);
    } catch {
      if (current === revision.current)
        setError("This file could not be read as UTF-8 text.");
    } finally {
      setLoadingFile(false);
    }
  }

  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    changed();
    sound.play("key");
    const number = Number(divisor);
    if (
      !/^[0-9]+$/.test(divisor) ||
      !Number.isSafeInteger(number) ||
      number < 1
    ) {
      setError(
        "Enter a positive whole number for the random divisor in Settings.",
      );
      return;
    }
    const requestInput =
      mode === "register"
        ? `${amountText(amounts.owed)},${amountText(amounts.paid)}`
        : input;
    if (new TextEncoder().encode(requestInput).byteLength > MAX_INPUT_BYTES) {
      setError("Input must be no larger than 1 MiB.");
      return;
    }
    const current = revision.current;
    const snapshot = {
      mode,
      currency,
      divisor: number,
      amounts: mode === "register" ? { ...amounts } : null,
      sequence: current,
    };
    setBusy(true);
    try {
      const response = await fetch("/api/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: requestInput,
          currency,
          divisor: number,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const data: unknown = await response.json();
      if (current !== revision.current) return;
      if (typeof data !== "object" || data === null)
        throw new Error("Unexpected server response.");
      if (!response.ok)
        throw new Error(
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Unable to calculate change.",
        );
      if (!("output" in data) || typeof data.output !== "string")
        throw new Error("Unexpected server response.");
      setReceipt({ ...snapshot, output: data.output });
      sound.play("success");
    } catch (failure) {
      if (current === revision.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to reach the server.",
        );
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!receipt) return;
    const url = URL.createObjectURL(
      new Blob([receipt.output], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "change.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <header className="toolbar">
        <div className="toolbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              ¢
            </span>
            <div>
              <h1>Cash Register</h1>
              <p>CREATIVE CASH DRAW SOLUTIONS</p>
            </div>
          </div>
          <div className="toolbar-controls">
            <div className="mode-switch" role="tablist" aria-label="Input mode">
              {(["register", "batch"] as const).map((value) => (
                <button
                  key={value}
                  ref={value === "register" ? registerTab : batchTab}
                  type="button"
                  role="tab"
                  id={`tab-${value}`}
                  aria-controls="entry-panel"
                  aria-selected={mode === value}
                  tabIndex={mode === value ? 0 : -1}
                  disabled={locked}
                  onClick={() => selectMode(value)}
                  onKeyDown={tabKeyboard}
                >
                  {value === "register" ? "Register" : "Batch"}
                </button>
              ))}
            </div>
            <button
              className="toolbar-button sound-toggle"
              type="button"
              aria-label="Sound"
              aria-pressed={sound.enabled}
              onClick={sound.toggle}
            >
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path d="M4 9h4l5-4v14l-5-4H4z" />
                {sound.enabled ? (
                  <path d="M17 8q5 4 0 8M19 4q9 8 0 16" />
                ) : (
                  <path d="m17 9 5 6m0-6-5 6" />
                )}
              </svg>
              <span>Sound {sound.enabled ? "on" : "off"}</span>
            </button>
            <details className="settings">
              <summary className="toolbar-button">
                <span>Settings</span>
                <span className="settings-summary">
                  {currency} · ÷{divisor || "—"}
                </span>
                <span className="settings-chevron" aria-hidden="true">
                  ⌄
                </span>
              </summary>
              <div className="settings-panel">
                <fieldset disabled={locked}>
                  <legend>Register settings</legend>
                  <label htmlFor="currency">Currency</label>
                  <select
                    id="currency"
                    value={currency}
                    onChange={(event) => {
                      changed();
                      setCurrency(event.target.value);
                    }}
                  >
                    <option value="USD">USD · US dollar</option>
                    <option value="EUR">EUR · Euro</option>
                  </select>
                  <label htmlFor="divisor">Random divisor</label>
                  <input
                    id="divisor"
                    type="number"
                    min="1"
                    step="1"
                    value={divisor}
                    onChange={(event) => {
                      changed();
                      setDivisor(event.target.value);
                    }}
                  />
                  <p>
                    When the amount owed in cents is divisible by this number,
                    the denominations are random. The total stays exact.
                  </p>
                </fieldset>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main className="workspace">
        <section className="operator-column">
          <div className="section-heading">
            <h2>
              {mode === "register"
                ? "Ring up a transaction"
                : "Process a batch"}
            </h2>
            <span className="section-caption">
              {mode === "register"
                ? "ONE SALE AT A TIME"
                : "FILE IN · CHANGE OUT"}
            </span>
          </div>
          <form
            id="entry-panel"
            className="entry-panel"
            role="tabpanel"
            aria-labelledby={`tab-${mode}`}
            onSubmit={(event) => {
              void calculate(event);
            }}
          >
            <div className="operator-strip">
              <span>
                <span
                  className={`indicator ${error ? "indicator-error" : busy ? "indicator-busy" : ""}`}
                  aria-hidden="true"
                />
                {error
                  ? "CHECK ENTRY"
                  : busy
                    ? "PROCESSING"
                    : loadingFile
                      ? "READING FILE"
                      : "READY"}
              </span>
              <span>
                {currency} <span aria-hidden="true">/</span> RANDOM ÷{" "}
                {divisor || "—"}
              </span>
            </div>
            <fieldset className="entry-controls" disabled={locked}>
              <legend className="visually-hidden">
                {mode === "register"
                  ? "Register transaction"
                  : "Batch transactions"}
              </legend>
              {mode === "register" ? (
                <RegisterEntry
                  amounts={amounts}
                  active={active}
                  currency={currency}
                  busy={locked}
                  onActive={setActive}
                  onKey={edit}
                  onPaste={paste}
                />
              ) : (
                <BatchEntry
                  input={input}
                  fileName={fileName}
                  onChange={(text) => {
                    changed();
                    setInput(text);
                    setFileName("");
                  }}
                  onSample={() => {
                    changed();
                    setInput(SAMPLE);
                    setFileName("");
                    sound.play("key");
                  }}
                  onFile={(file) => {
                    void loadFile(file);
                  }}
                />
              )}
              <button className="key calculate-key" type="submit">
                <span>
                  {busy
                    ? "Calculating…"
                    : loadingFile
                      ? "Reading file…"
                      : "Calculate change"}
                </span>
                <span className="calculate-symbol" aria-hidden="true">
                  ↵
                </span>
              </button>
            </fieldset>
            {error && (
              <p className="error" role="alert">
                <strong>Entry needs attention.</strong> {error}
              </p>
            )}
            <div className="operator-footer">
              <span>EXACT CENTS. EVERY TIME.</span>
              <span>USD / EUR</span>
            </div>
          </form>
          <p className="workspace-note">
            {mode === "register"
              ? "Select an amount to enter it. No decimal key needed."
              : "The complete batch is validated before results are returned."}
          </p>
        </section>
        <Receipt
          receipt={receipt}
          busy={locked}
          error={Boolean(error)}
          onDownload={download}
        />
      </main>
      <footer className="page-footer">
        <span>CREATIVE CASH DRAW SOLUTIONS</span>
        <span>Minimum pieces. A random twist. Always exact.</span>
      </footer>
      <span className="visually-hidden" role="status">
        {sound.unavailable
          ? "Sound is unavailable. All register controls still work."
          : ""}
      </span>
    </>
  );
}
