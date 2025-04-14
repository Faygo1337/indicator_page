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
      id: 1,
      linkedWallet: wallet,
      topupWallet: "ADgHfNqhY61Pcy3nHmsRDpczMkJ5DnTnZozKcGsM6wZh",
      subExpAt: 123,
      createdAt: 123,
      exp: 123,
      iat: 123,
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
    accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjcmVhdGVkQXQiOjE3NDQyOTcxNTMsImV4cCI6MTc0NDM4MzcyMywiaWF0IjoxNzQ0Mjk3MzIzLCJpZCI6MywibGlua2VkV2FsbGV0IjoiMnl6RUQzS2FXTDY1WUJxMlVTd0dIV2JkUE5QM2JxNlRRN1JBaUhic2JaQ2ciLCJzdWJFeHBBdCI6MCwidG9wdXBXYWxsZXQiOiIzekU4cUE4eFN1Nk5QbzR5V0trN3dWYXdWc3Nlb3hZS3VvTld1VlZLc1lxbiJ9.HeH-csxMUSyqV_6b_2HW5hfH1UAxFYTuTQ4_0z9E2Yw",
    expireAt: "2025-05-10 22:02:50.761638 +0300 +03",
    hasSubscription: Math.random() > 0.5,
    success: true
  }
}
