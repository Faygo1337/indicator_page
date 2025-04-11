import type { VerifyResponse, PaymentResponse } from "./types"

// Mock API functions
export async function verifyWallet(signature: string, wallet: string): Promise<VerifyResponse> {
  // In a real app, this would be a fetch call to your API
  console.log("Verifying wallet:", wallet, "with signature:", signature)

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1000))

  // Mock response
  return {
    token:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyXzEyMyIsImNvbm5lY3RlZFdhbGxldCI6IndhbGxldF8xMjMiLCJ0b3B1cFdhbGxldCI6InRvcHVwX3dhbGxldF8xMjMiLCJzdWJzY3JpcHRpb25FeHBpcmVBdCI6bnVsbCwianRUb2tlbiI6ImFjY2Vzc190b2tlbl8xMjMifQ.8yUBiUs9cqUEEtX9vYlVnuHgJZGZlR3d-OsLhAJqQlA",
    payload: {
      userId: "user_123",
      connectedWallet: wallet,
      topupWallet: "topup_wallet_123",
      subscriptionExpireAt: null,
      jwtToken: "access_token_123",
    },
  }
}

export async function checkPayment(): Promise<PaymentResponse> {
  // In a real app, this would be a fetch call to your API
  console.log("Checking payment status")

  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1500))

  // Mock response - randomly return true or false
  return {
    status: Math.random() > 0.5,
  }
}
