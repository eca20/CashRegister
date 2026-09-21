import { StrictMode, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const SAMPLE = "2.12,3.00\n1.97,2.00\n3.33,5.00";
const MAX_BYTES = 1024 * 1024;

function App() {
  const [input, setInput] = useState(SAMPLE);
  const [currency, setCurrency] = useState("USD");
  const [divisor, setDivisor] = useState("3");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const revision = useRef(0);

  function changed() {
    revision.current++;
    setOutput(null);
    setError("");
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    changed();
    const current = revision.current;
    if (file.size > MAX_BYTES) {
      setError("Choose a file no larger than 1 MiB.");
      return;
    }
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
    }
  }

  async function calculate(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOutput(null);
    const number = Number(divisor);
    if (
      !/^[0-9]+$/.test(divisor) ||
      !Number.isSafeInteger(number) ||
      number < 1
    ) {
      setError("Enter a positive whole number for the random divisor.");
      return;
    }
    if (new TextEncoder().encode(input).byteLength > MAX_BYTES) {
      setError("Input must be no larger than 1 MiB.");
      return;
    }
    const current = ++revision.current;
    setBusy(true);
    try {
      const response = await fetch("/api/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, currency, divisor: number }),
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
      setOutput(data.output);
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
    if (output === null) return;
    const url = URL.createObjectURL(
      new Blob([output], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "change.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const results =
    output === null || output === "" ? [] : output.trimEnd().split("\n");

  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ¢
          </span>{" "}
          Cash Register
        </a>
        <span className="top-note">Creative Cash Draw Solutions</span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">A LITTLE CHANGE. A LITTLE SURPRISE.</p>
          <h1>Change, made simple.</h1>
          <p>
            Turn your transactions into exact change.
            <br className="desktop-break" /> The fewest pieces, with an
            occasional random twist.
          </p>
        </section>
        <div className="workspace">
          <form
            className="panel input-panel"
            onSubmit={(event) => {
              void calculate(event);
            }}
          >
            <div className="panel-heading">
              <span className="step">01</span>
              <h2>Your transactions</h2>
              <span className="label-tag">INPUT</span>
            </div>
            <fieldset disabled={busy}>
              <div className="input-actions">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => fileInput.current?.click()}
                >
                  ↑ Upload a file
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    changed();
                    setInput(SAMPLE);
                    setFileName("");
                  }}
                >
                  Use sample
                </button>
              </div>
              <input
                ref={fileInput}
                className="file-input"
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                aria-label="Upload transactions"
                onChange={(event) => {
                  void loadFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <label htmlFor="transactions">Amount owed, amount paid</label>
              <p id="input-help" className="hint">
                One transaction per line. Use a decimal point, e.g. 2.12,3.00.
              </p>
              <textarea
                id="transactions"
                aria-describedby="input-help"
                spellCheck={false}
                value={input}
                onChange={(event) => {
                  changed();
                  setInput(event.target.value);
                  setFileName("");
                }}
              />
              <p className="file-note">
                {fileName || "Paste amounts or upload a .txt / .csv file"}
                <span>UTF-8 · max 1 MiB</span>
              </p>
              <div className="options">
                <div>
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
                </div>
                <div>
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
                </div>
              </div>
              <div className="rule-note">
                <span aria-hidden="true">↳</span>
                <p>
                  When the amount <strong>owed in cents</strong> is divisible by{" "}
                  {divisor || "…"}, the breakdown is random. The total stays
                  exact.
                </p>
              </div>
              <button className="button primary" type="submit">
                {busy ? "Calculating…" : "Calculate change"}
                <span aria-hidden="true">→</span>
              </button>
            </fieldset>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
          <section
            className="panel output-panel"
            aria-labelledby="output-title"
            aria-busy={busy}
          >
            <div className="panel-heading">
              <span className="step">02</span>
              <h2 id="output-title">Change to return</h2>
              <span className="label-tag">OUTPUT</span>
            </div>
            <div className="output-body" aria-live="polite">
              {output === null ? (
                <div className="empty">
                  <div className="coin-stack" aria-hidden="true">
                    <span>25</span>
                    <span>10</span>
                    <span>1</span>
                  </div>
                  <h3>Every cent accounted for.</h3>
                  <p>
                    Your denomination breakdowns will appear here,
                    <br /> in the same order as your transactions.
                  </p>
                </div>
              ) : results.length === 0 ? (
                <div className="empty">
                  <h3>No transactions in this file.</h3>
                  <p>The output file is empty, too.</p>
                </div>
              ) : (
                <>
                  <p className="result-count">
                    {results.length}{" "}
                    {results.length === 1 ? "transaction" : "transactions"}{" "}
                    processed
                  </p>
                  <ol className="results">
                    {results.slice(0, 100).map((result, index) => (
                      <li key={index}>
                        <span className="row-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p>{result.split(",").join(", ")}</p>
                      </li>
                    ))}
                  </ol>
                  {results.length > 100 && (
                    <p className="result-note">
                      Showing the first 100 results. Download the .txt file for
                      all {results.length} transactions.
                    </p>
                  )}
                  <p className="result-note">
                    Random results stay here until you calculate again.
                  </p>
                </>
              )}
            </div>
            <div className="output-footer">
              <span>One line in. One line out.</span>
              <button
                type="button"
                className="button secondary"
                disabled={output === null || busy}
                onClick={download}
              >
                ↓ Download .txt
              </button>
            </div>
          </section>
        </div>
        <footer className="page-footer">
          <span>Exact totals. Clear denominations.</span>
          <span>USD & EUR · File in, change out.</span>
        </footer>
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
