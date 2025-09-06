import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { ticketId, gameId, prizeType, drawnNumbers } = await req.json()

    // Get ticket and game data
    const [ticketRes, gameRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', ticketId).single(),
      supabase.from('games').select('*').eq('id', gameId).single()
    ])

    if (ticketRes.error || gameRes.error) {
      throw new Error('Invalid ticket or game')
    }

    const ticket = ticketRes.data
    const game = gameRes.data

    // Check if already claimed
    if (ticket.claimed_prizes?.[prizeType]) {
      throw new Error('Prize already claimed')
    }

    // Validate prize claim
    const isValid = validatePrizeClaim(ticket.numbers, drawnNumbers, prizeType)
    
    if (!isValid) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid prize claim' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Calculate prize amount
    const amount = calculatePrizeAmount(game.prize_pool, prizeType)

    // Update ticket
    const updatedPrizes = { ...ticket.claimed_prizes, [prizeType]: true }
    await supabase
      .from('tickets')
      .update({ claimed_prizes: updatedPrizes })
      .eq('id', ticketId)

    // Credit user wallet using safe function
    const { data: walletResult, error: walletError } = await supabase
      .rpc('increment_wallet', {
        user_id: ticket.user_id,
        amount_to_add: amount
      })

    if (walletError || !walletResult) {
      throw new Error('Failed to credit wallet balance')
    }

    // Add transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: ticket.user_id,
        type: 'credit',
        amount: amount,
        reason: `Prize: ${prizeType}`,
        game_id: gameId
      })

    return new Response(JSON.stringify({ success: true, amount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function validatePrizeClaim(ticketNumbers: number[], drawnNumbers: number[], prizeType: string): boolean {
  const matchedNumbers = ticketNumbers.filter(num => drawnNumbers.includes(num))
  
  switch (prizeType) {
    case 'early_five':
      return matchedNumbers.length >= 5
    case 'top_line':
    case 'middle_line': 
    case 'bottom_line':
      return matchedNumbers.length >= 5 // Simplified validation
    case 'full_house':
      return matchedNumbers.length === 15
    default:
      return false
  }
}

function calculatePrizeAmount(prizePool: number, prizeType: string): number {
  switch (prizeType) {
    case 'early_five': return Math.floor(prizePool * 0.20)
    case 'top_line': return Math.floor(prizePool * 0.15)
    case 'middle_line': return Math.floor(prizePool * 0.15)
    case 'bottom_line': return Math.floor(prizePool * 0.15)
    case 'full_house': return Math.floor(prizePool * 0.35)
    default: return 0
  }
}