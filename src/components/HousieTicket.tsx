import { Card, CardContent } from "@/components/ui/card";

interface HousieTicketProps {
  numbers: number[][];
  gameId?: string;
  ticketId?: string;
  className?: string;
}

const HousieTicket = ({ numbers, gameId, ticketId, className = "" }: HousieTicketProps) => {
  // Safely handle different data formats
  let ticket: number[][];
  
  try {
    if (!numbers) {
      ticket = [[], [], []];
    } else if (Array.isArray(numbers)) {
      // If it's already a 2D array
      if (Array.isArray(numbers[0])) {
        ticket = numbers;
      } else {
        // If it's a flat array, convert to 3x5 grid
        ticket = [[], [], []];
        numbers.forEach((num, index) => {
          const row = Math.floor(index / 5);
          if (row < 3) {
            ticket[row].push(num);
          }
        });
      }
    } else {
      // If it's a string or other format, try to parse
      ticket = JSON.parse(String(numbers));
      if (!Array.isArray(ticket)) {
        ticket = [[], [], []];
      }
    }
  } catch (error) {
    console.error('Error parsing ticket numbers:', error);
    ticket = [[], [], []];
  }
  
  // Ensure we have exactly 3 rows
  while (ticket.length < 3) {
    ticket.push([]);
  }
  ticket = ticket.slice(0, 3);
  
  // Pad rows to ensure 5 numbers each
  const paddedTicket = ticket.map(row => {
    if (!Array.isArray(row)) {
      return [0, 0, 0, 0, 0];
    }
    const padded = [...row];
    while (padded.length < 5) {
      padded.push(0); // Use 0 as placeholder
    }
    return padded.slice(0, 5);
  });

  // Create column headers for 1-9, 10-19, 20-29, etc.
  const columnHeaders = [];
  for (let i = 0; i < 9; i++) {
    const start = i * 10 + 1;
    const end = (i + 1) * 10;
    columnHeaders.push(`${start}-${end}`);
  }

  return (
    <Card className={`w-full max-w-sm mx-auto bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 ${className}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-blue-800">TAMBOLA TICKET</h3>
          {gameId && (
            <p className="text-sm text-blue-600">Game #{gameId.slice(-6)}</p>
          )}
          {ticketId && (
            <p className="text-xs text-gray-500">Ticket #{ticketId.slice(-8)}</p>
          )}
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-9 gap-1 mb-2">
          {columnHeaders.map((header, index) => (
            <div key={index} className="text-center text-xs font-bold text-blue-600 py-1">
              {header}
            </div>
          ))}
        </div>

        {/* Ticket Grid - 9 columns, 3 rows */}
        <div className="space-y-1">
          {paddedTicket.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-9 gap-1">
              {/* Create 9 columns, but only show numbers in 5 of them */}
              {Array.from({ length: 9 }, (_, colIndex) => {
                // For each column, check if we have a number that belongs to this range
                const columnStart = colIndex * 10 + 1;
                const columnEnd = (colIndex + 1) * 10;
                
                // Find if any number in this row belongs to this column range
                const numberInColumn = row.find(num => 
                  num >= columnStart && num <= columnEnd
                );
                
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`
                      w-8 h-8 flex items-center justify-center text-sm font-bold
                      border border-blue-300 rounded
                      ${numberInColumn 
                        ? 'bg-white text-blue-800 hover:bg-blue-50' 
                        : 'bg-gray-100 text-gray-300'
                      }
                    `}
                  >
                    {numberInColumn || ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <div className="text-xs text-gray-500 space-y-1">
            <p>Good Luck!</p>
            <p className="text-blue-600 font-semibold">Play Responsibly</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HousieTicket;
