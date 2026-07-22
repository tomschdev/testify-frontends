import http2 from "node:http2";

/**
 * Minimal grpc-web → native gRPC bridge for unary calls.
 *
 * The browser stubs (generated with format 'text') speak grpc-web-text:
 * base64-encoded gRPC frames over HTTP/1.1. The backend Cloud Run services
 * speak native gRPC only (HTTP/2 + trailers). For unary calls the 5-byte
 * message framing is byte-identical on both protocols, so the bridge is:
 * decode base64 → forward frames over HTTP/2 → re-encode the response with
 * the gRPC trailers appended as a grpc-web trailer frame (flag 0x80).
 *
 * This mirrors the role grpcweb.WrapServer + ServiceProxy play in the alis
 * Go console services (see bahnsen console server.go reference).
 */

const TRAILER_FRAME_FLAG = 0x80;

export interface GrpcForwardResult {
  /** grpc-web-text body: framed messages + trailer frame, base64-encoded. */
  bodyBase64: string;
}

function trailerFrame(entries: Record<string, string>): Buffer {
  const text = Object.entries(entries)
    .map(([k, v]) => `${k}: ${v}\r\n`)
    .join("");
  const payload = Buffer.from(text, "utf8");
  const frame = Buffer.alloc(5 + payload.length);
  frame.writeUInt8(TRAILER_FRAME_FLAG, 0);
  frame.writeUInt32BE(payload.length, 1);
  payload.copy(frame, 5);
  return frame;
}

/** A grpc-web-text body carrying only a status trailer (local errors). */
export function statusOnlyBody(status: number, message: string): string {
  return trailerFrame({
    "grpc-status": String(status),
    "grpc-message": encodeURIComponent(message),
  }).toString("base64");
}

/** A non-OK gRPC status from an upstream service. */
export class GrpcStatusError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "GrpcStatusError";
  }
}

/**
 * Server-side unary call: serialize a request message, get the response
 * message back, or throw GrpcStatusError. This is the same wire path as the
 * browser bridge (forwardUnary), used where a route handler is itself the
 * client — e.g. the issuer's credential-issuance flow fetching the org's
 * signing key without that key ever transiting the browser.
 */
export async function callUnary(
  host: string,
  path: string,
  requestMessage: Uint8Array,
  headers: Record<string, string>,
): Promise<Buffer> {
  const frame = Buffer.alloc(5 + requestMessage.length);
  frame.writeUInt8(0, 0);
  frame.writeUInt32BE(requestMessage.length, 1);
  Buffer.from(requestMessage).copy(frame, 5);

  const { bodyBase64 } = await forwardUnary(host, path, frame, headers);

  // Walk the grpc-web frames: message frames (flag 0) and the trailer frame
  // (flag 0x80) forwardUnary appended, carrying grpc-status/grpc-message.
  const body = Buffer.from(bodyBase64, "base64");
  let offset = 0;
  let message: Buffer | null = null;
  let status = 2;
  let statusMessage = "malformed response: no trailer frame";
  while (offset + 5 <= body.length) {
    const flag = body.readUInt8(offset);
    const length = body.readUInt32BE(offset + 1);
    const payload = body.subarray(offset + 5, offset + 5 + length);
    offset += 5 + length;
    if (flag === TRAILER_FRAME_FLAG) {
      for (const line of payload.toString("utf8").split("\r\n")) {
        const sep = line.indexOf(": ");
        if (sep === -1) continue;
        const key = line.slice(0, sep);
        const value = line.slice(sep + 2);
        if (key === "grpc-status") status = Number(value);
        if (key === "grpc-message") statusMessage = decodeURIComponent(value);
      }
      if (status === 0) statusMessage = "";
    } else {
      message = Buffer.from(payload);
    }
  }

  if (status !== 0) throw new GrpcStatusError(status, statusMessage);
  if (!message) throw new GrpcStatusError(2, "malformed response: no message frame");
  return message;
}

export function forwardUnary(
  host: string,
  path: string,
  requestFrames: Buffer,
  headers: Record<string, string>,
  timeoutMs = 25_000,
): Promise<GrpcForwardResult> {
  return new Promise((resolve, reject) => {
    const session = http2.connect(host);
    const chunks: Buffer[] = [];
    let responseHeaders: http2.IncomingHttpHeaders = {};
    let responseTrailers: http2.IncomingHttpHeaders = {};
    let settled = false;

    const finish = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      session.close();
      fn();
    };

    const timer = setTimeout(
      () => finish(() => reject(new Error(`upstream timeout after ${timeoutMs}ms`))),
      timeoutMs,
    );

    session.on("error", (err) => finish(() => reject(err)));

    const stream = session.request({
      ":method": "POST",
      ":path": path,
      "content-type": "application/grpc+proto",
      te: "trailers",
      ...headers,
    });
    stream.on("error", (err) => finish(() => reject(err)));
    stream.on("response", (h) => {
      responseHeaders = h;
    });
    stream.on("trailers", (t) => {
      responseTrailers = t;
    });
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => {
      finish(() => {
        // Status lives in trailers normally, or in the initial headers for
        // trailers-only (immediate error) responses.
        const status = String(
          responseTrailers["grpc-status"] ?? responseHeaders["grpc-status"] ?? "2",
        );
        const message = String(
          responseTrailers["grpc-message"] ?? responseHeaders["grpc-message"] ?? "",
        );
        const body = Buffer.concat([
          ...chunks,
          trailerFrame({ "grpc-status": status, "grpc-message": message }),
        ]);
        resolve({ bodyBase64: body.toString("base64") });
      });
    });

    stream.end(requestFrames);
  });
}
