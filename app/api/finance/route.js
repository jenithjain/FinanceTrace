import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      message: "FinanceTrace API root",
      data: {
        basePath: "/api/finance",
        endpoints: {
          auth: [
            "POST /api/finance/auth/register",
            "POST /api/finance/auth/login"
          ],
          dashboard: [
            "GET /api/finance/dashboard/summary",
            "GET /api/finance/dashboard/by-category",
            "GET /api/finance/dashboard/trends",
            "GET /api/finance/dashboard/recent"
          ],
          transactions: [
            "GET /api/finance/transactions",
            "POST /api/finance/transactions",
            "GET /api/finance/transactions/:id",
            "PATCH /api/finance/transactions/:id",
            "DELETE /api/finance/transactions/:id"
          ],
          users: [
            "GET /api/finance/users",
            "GET /api/finance/users/:id",
            "PATCH /api/finance/users/:id/role",
            "PATCH /api/finance/users/:id/status",
            "PATCH /api/finance/users/:id/role-request",
            "PATCH /api/finance/users/request-role"
          ],
          assistant: ["POST /api/finance/assistant"]
        }
      }
    },
    { status: 200 }
  );
}
