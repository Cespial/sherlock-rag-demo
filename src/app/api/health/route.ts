import { NextResponse } from "next/server";

export async function GET() {
  const keys = {
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    voyage: !!process.env.VOYAGE_API_KEY,
    pinecone: !!process.env.PINECONE_API_KEY,
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const allConfigured = Object.values(keys).every(Boolean);

  return NextResponse.json({
    status: allConfigured ? "ok" : "missing_keys",
    keys,
    timestamp: new Date().toISOString(),
  });
}
