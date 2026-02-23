// ─── XMTP Client Factory ──────────────────────────────────────────────────────
//
// Creates and manages a singleton XMTP client from a wagmi walletClient.
// Shared by both chat (useXmtpChat) and accept communication (useXmtpAccept).

import { Client, IdentifierKind } from '@xmtp/browser-sdk'

let clientPromise = null
let currentAddress = null

/**
 * Create an XMTP EOA signer from a viem walletClient.
 */
export function createXmtpSigner(walletClient) {
  const address = walletClient.account.address.toLowerCase()

  return {
    type: 'EOA',
    getIdentifier: () => ({
      identifier: address,
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message) => {
      const signature = await walletClient.signMessage({
        message: typeof message === 'string' ? message : { raw: message },
      })
      // Convert hex signature to Uint8Array
      return new Uint8Array(
        signature
          .slice(2)
          .match(/.{2}/g)
          .map((b) => parseInt(b, 16))
      )
    },
  }
}

/**
 * Get or create a singleton XMTP client for the given walletClient.
 * Re-creates if the wallet address has changed.
 */
export async function getOrCreateClient(walletClient) {
  const address = walletClient.account.address.toLowerCase()

  if (clientPromise && currentAddress === address) {
    return clientPromise
  }

  currentAddress = address
  clientPromise = Client.create(createXmtpSigner(walletClient), {
    env: 'dev',
  })

  return clientPromise
}

/**
 * Reset the singleton client (call on wallet disconnect).
 */
export function resetClient() {
  clientPromise = null
  currentAddress = null
}
