import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "../src/security.js";

describe("network target protection", () => {
  it.each(["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.1.1", "::1", "fd00::1"])(
    "identifies private address %s",
    (address) => expect(isPrivateAddress(address)).toBe(true),
  );

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => expect(isPrivateAddress(address)).toBe(false),
  );
});
