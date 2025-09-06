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

    const { gameId, userId, ticketPrice } = await req.json()

    // Generate tambola ticket
    const numbers = generateTambolaTicket()

    // Start transaction
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('wallet')
      .eq('id', userId)
      .single()

    if (userError || user.wallet < ticketPrice) {
      throw new Error('Insufficient wallet balance')
    }

    // Check game availability
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (gameError || game.total_tickets >= game.max_tickets) {
      throw new Error('Game full or not available')
    }

    // Create ticket
    const { error: ticketError } = await supabase
      .from('tickets')
      .insert({
        game_id: gameId,
        user_id: userId,
        numbers: numbers,
        claimed_prizes: {}
      })

    if (ticketError) throw ticketError

    // Update user wallet using safe function
    const { data: walletResult, error: walletError } = await supabase
      .rpc('decrement_wallet', {
        user_id: userId,
        amount_to_subtract: ticketPrice
      })

    if (walletError || !walletResult) {
      throw new Error('Failed to deduct wallet balance')
    }

    // Update game stats
    const newTotal = game.total_tickets + 1
    const newCollection = game.total_collection + ticketPrice
    const adminCommission = newCollection * 0.20
    const prizePool = newCollection - adminCommission

    const { error: gameUpdateError } = await supabase
      .from('games')
      .update({
        total_tickets: newTotal,
        total_collection: newCollection,
        admin_commission: adminCommission,
        prize_pool: prizePool
      })
      .eq('id', gameId)

    if (gameUpdateError) throw gameUpdateError

    // Add transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'debit',
        amount: ticketPrice,
        reason: 'Ticket purchase',
        game_id: gameId
      })

    return new Response(JSON.stringify({ success: true, numbers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function generateTambolaTicket(): number[][] {
  // Create a 3x5 grid for housie ticket (3 rows, 5 numbers each)
  const ticket: number[][] = [[], [], []]
  
  // Define column ranges: 1-9, 10-19, 20-29, 30-39, 40-49, 50-59, 60-69, 70-79, 80-89
  const columnRanges = [
    { min: 1, max: 9 },
    { min: 10, max: 19 },
    { min: 20, max: 29 },
    { min: 30, max: 39 },
    { min: 40, max: 49 },
    { min: 50, max: 59 },
    { min: 60, max: 69 },
    { min: 70, max: 79 },
    { min: 80, max: 89 }
  ]
  
  // For each row, select 5 numbers from different columns
  for (let row = 0; row < 3; row++) {
    const usedColumns = new Set<number>()
    const rowNumbers: number[] = []
    
    // Select 5 numbers, each from a different column
    for (let i = 0; i < 5; i++) {
      let columnIndex: number
      let attempts = 0
      
      // Find an unused column
      do {
        columnIndex = Math.floor(Math.random() * 9)
        attempts++
      } while (usedColumns.has(columnIndex) && attempts < 50)
      
      // If we can't find an unused column, pick any column
      if (attempts >= 50) {
        columnIndex = Math.floor(Math.random() * 9)
      }
      
      usedColumns.add(columnIndex)
      
      // Select a random number from this column range
      const range = columnRanges[columnIndex]
      const availableNumbers = []
      for (let num = range.min; num <= range.max; num++) {
        availableNumbers.push(num)
      }
      
      // Shuffle and pick a number
      const shuffled = availableNumbers.sort(() => Math.random() - 0.5)
      const selectedNumber = shuffled[0]
      
      rowNumbers.push(selectedNumber)
    }
    
    // Sort the row numbers
    rowNumbers.sort((a, b) => a - b)
    ticket[row] = rowNumbers
  }
  
  // Ensure no duplicate numbers across the entire ticket
  const allNumbers: number[] = []
  ticket.forEach(row => allNumbers.push(...row))
  
  // If there are duplicates, regenerate the ticket
  const uniqueNumbers = new Set(allNumbers)
  if (uniqueNumbers.size !== 15) {
    console.log('Duplicate numbers found, regenerating ticket...')
    return generateTambolaTicket()
  }
  
  return ticket
}