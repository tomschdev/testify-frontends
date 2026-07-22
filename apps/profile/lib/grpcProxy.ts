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
