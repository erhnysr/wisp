/**
 * JSON.parse that keeps long integer nonces exact.
 *
 * technocore-chat serialises message nonces as JSON numbers, and tclk frames inside messages do
 * the same. Nanosecond nonces have 19 digits, past 2^53, so a plain JSON.parse rounds them
 * (…873 → …800) and any signature over the nonce stops verifying. This quotes `"nonce": <16+
 * digits>` before parsing, so those values arrive as exact strings; every other number is left
 * alone. Inside an outer JSON string the same key is escaped (`\"nonce\":`) and does not match.
 */
export function parseJsonKeepingNonces<T = unknown>(raw: string): T {
  return JSON.parse(raw.replace(/"nonce"\s*:\s*(-?\d{16,})/g, '"nonce":"$1"')) as T;
}
