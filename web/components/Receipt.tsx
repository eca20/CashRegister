import { amountText } from "../entry";
import type { Amounts } from "../entry";

export interface ReceiptData {
  readonly output: string;
  readonly mode: "register" | "batch";
  readonly currency: string;
  readonly divisor: number;
  readonly amounts: Amounts | null;
  readonly sequence: number;
}

interface Props {
  receipt: ReceiptData | null;
  busy: boolean;
  error: boolean;
  onDownload: () => void;
}

export function Receipt({ receipt, busy, error, onDownload }: Props) {
  const results = receipt?.output ? receipt.output.trimEnd().split("\n") : [];
  const status = busy
    ? "Processing transaction"
    : error
      ? "Check your entry"
      : receipt
        ? `${results.length} ${results.length === 1 ? "transaction" : "transactions"} processed`
        : "Ready for a transaction";
  return (
    <section
      className="receipt-column"
      aria-labelledby="receipt-title"
      aria-busy={busy}
    >
      <div className="section-heading">
        <h2 id="receipt-title">Your receipt</h2>
        <span
          className={`status ${receipt ? "status-success" : ""}`}
          role="status"
        >
          <span aria-hidden="true" />
          {status}
        </span>
      </div>
      <div className="receipt-stage">
        <div
          className={`receipt-paper ${receipt ? "is-printed" : ""}`}
          key={receipt?.sequence ?? "empty"}
        >
          <div className="receipt-brand">
            <span className="receipt-monogram" aria-hidden="true">
              CC
            </span>
            <strong>CREATIVE CASH DRAW</strong>
            <span>CHANGE, ACCOUNTED FOR.</span>
          </div>
          <div className="receipt-rule" />
          {!receipt ? (
            <div className="receipt-empty">
              <span className="paper-label">
                {busy
                  ? "CALCULATING…"
                  : error
                    ? "TRANSACTION ON HOLD"
                    : "AWAITING TRANSACTION"}
              </span>
              <p>
                {error
                  ? "Correct the entry to continue."
                  : "Enter the amount owed and paid, then calculate your change."}
              </p>
              <div className="receipt-placeholder" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <p className="paper-small">
                Your exact denomination breakdown
                <br />
                will be printed here.
              </p>
            </div>
          ) : (
            <>
              <div className="receipt-meta">
                <span>
                  {receipt.mode === "register"
                    ? "COUNTER TRANSACTION"
                    : "BATCH TRANSACTIONS"}
                </span>
                <span>{receipt.currency}</span>
              </div>
              {receipt.amounts && (
                <>
                  <dl className="receipt-amounts">
                    <div>
                      <dt>Amount owed</dt>
                      <dd>{amountText(receipt.amounts.owed)}</dd>
                    </div>
                    <div>
                      <dt>Amount paid</dt>
                      <dd>{amountText(receipt.amounts.paid)}</dd>
                    </div>
                  </dl>
                  <div className="receipt-total">
                    <span>CHANGE DUE</span>
                    <strong>
                      {amountText(receipt.amounts.paid - receipt.amounts.owed)}
                    </strong>
                  </div>
                </>
              )}
              <p className="paper-label breakdown-label">
                DENOMINATIONS TO RETURN
              </p>
              {results.length === 0 ? (
                <p className="empty-batch">No transactions in this file.</p>
              ) : (
                <ol className="results">
                  {results.slice(0, 100).map((result, index) => (
                    <li key={index}>
                      {receipt.mode === "batch" && (
                        <span className="receipt-line-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      )}
                      <p>{result.split(",").join(", ")}</p>
                    </li>
                  ))}
                </ol>
              )}
              {results.length > 100 && (
                <p className="preview-notice">
                  Showing the first 100 results. Download the .txt file for all{" "}
                  {results.length} transactions.
                </p>
              )}
              <div className="receipt-rule" />
              <p className="receipt-thanks">EVERY CENT ACCOUNTED FOR.</p>
              <p className="paper-small">
                Random divisor: {receipt.divisor}
                <br />
                Results stay fixed until you calculate again.
              </p>
            </>
          )}
          <div className="receipt-perforation" aria-hidden="true" />
        </div>
      </div>
      <button
        className="key download-key"
        type="button"
        disabled={!receipt || busy}
        onClick={onDownload}
      >
        <span aria-hidden="true">↓</span> Download .txt
      </button>
      <p className="receipt-footnote">
        A complete text file. One transaction per line.
      </p>
    </section>
  );
}
