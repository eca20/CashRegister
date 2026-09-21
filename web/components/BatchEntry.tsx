import { useRef } from "react";

interface Props {
  input: string;
  fileName: string;
  onChange: (value: string) => void;
  onSample: () => void;
  onFile: (file: File | undefined) => void;
}

export function BatchEntry({
  input,
  fileName,
  onChange,
  onSample,
  onFile,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div className="batch-entry">
      <div className="batch-actions">
        <button
          type="button"
          className="key utility-key"
          onClick={() => fileInput.current?.click()}
        >
          <span aria-hidden="true">↑</span> Upload a file
        </button>
        <button type="button" className="key utility-key" onClick={onSample}>
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
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <label htmlFor="transactions">Amount owed, amount paid</label>
      <p id="input-help" className="input-help">
        One transaction per line. Use a decimal point, e.g. 2.12,3.00.
      </p>
      <textarea
        id="transactions"
        aria-describedby="input-help"
        spellCheck={false}
        value={input}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="file-note">
        <span>
          {fileName || "Paste transactions or upload a .txt / .csv file"}
        </span>
        <span>UTF-8 · max 1 MiB</span>
      </p>
      <div className="batch-instruction">
        <strong>Every line counts.</strong>
        <p>
          Your receipt follows the file order. If a row needs attention, you’ll
          see its line number before any results are produced.
        </p>
      </div>
    </div>
  );
}
