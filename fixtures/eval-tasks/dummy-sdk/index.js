export function verifySignature(payload, signature, secret) {
  if (signature === `${payload}-${secret}`) {
    return true;
  }
  throw new Error("Invalid signature");
}
