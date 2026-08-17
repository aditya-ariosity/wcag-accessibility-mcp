import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return false;
  }

  const [first, second, third] = octets;
  return first === 10
    || first === 127
    || first === 0
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 192 && second === 0)
    || (first === 192 && second === 88 && third === 99)
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 198 && (second === 18 || second === 19))
    || (first === 198 && second === 51 && third === 100)
    || (first === 203 && second === 0 && third === 113)
    || first >= 224;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return true;
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("fe8")
    || normalized.startsWith("fe9")
    || normalized.startsWith("fea")
    || normalized.startsWith("feb")
    || normalized.startsWith("fec")
    || normalized.startsWith("fed")
    || normalized.startsWith("fee")
    || normalized.startsWith("fef")
    || normalized.startsWith("2002:")
    || normalized.startsWith("64:ff9b:")
    || normalized.startsWith("2001:db8:");
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return false;
}

export function allowsPrivateTargets(): boolean {
  if (process.env.A11Y_MCP_ALLOW_PRIVATE === "true") return true;
  if (process.env.A11Y_MCP_ALLOW_PRIVATE === "false") return false;
  return process.env.A11Y_MCP_TRANSPORT !== "http";
}

export async function validateAuditUrl(input: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("The target must be a valid absolute URL.");
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("audit_url only accepts http:// or https:// URLs.");
  }

  if (url.username || url.password) {
    throw new Error("Credentials embedded in URLs are not accepted.");
  }

  if (allowsPrivateTargets()) return url;

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Private and localhost targets are blocked for HTTP transport. Set A11Y_MCP_ALLOW_PRIVATE=true only in a trusted environment.");
  }

  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });

  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("The URL resolves to a private or reserved network address, which is blocked for HTTP transport.");
  }

  return url;
}
