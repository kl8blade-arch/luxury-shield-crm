import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/**
 * POST /api/migrations/sophia-pricing
 * Adds SophiaOS pricing columns to agents table
 */
export async function POST(req: NextRequest) {
  try {
    // Check if columns already exist
    const { data: checkData, error: checkError } = await supabase
      .from('agents')
      .select('plan, plan_status, plan_is_annual, plan_activated_at, stripe_subscription_id')
      .limit(1)

    if (!checkError && checkData && checkData.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Columns already exist',
      })
    }

    // If we can't select, the columns don't exist
    // Return SQL for manual execution
    return NextResponse.json({
      success: false,
      message: 'Columns do not exist. Run this SQL manually in Supabase:\n',
      sql: `ALTER TABLE agents
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS plan_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS plan_is_annual BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMPTZ;`.trim(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
