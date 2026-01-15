// Helper function to get the appropriate rating based on tournament time control
export const getRatingForTimeControl = (
  player: {
    rating: number;
    rapid_rating?: number | null;
    blitz_rating?: number | null;
  },
  timeControl?: string | null
): number => {
  if (!timeControl) {
    return player.rating;
  }

  switch (timeControl.toLowerCase()) {
    case 'rapid':
      return player.rapid_rating || player.rating;
    case 'blitz':
      return player.blitz_rating || player.rating;
    case 'classical':
    default:
      return player.rating;
  }
};

// Helper to format rating display with time control indicator
export const formatRatingDisplay = (
  player: {
    rating: number;
    rapid_rating?: number | null;
    blitz_rating?: number | null;
  },
  timeControl?: string | null
): string => {
  const rating = getRatingForTimeControl(player, timeControl);
  
  // Add indicator for non-classical ratings
  if (timeControl === 'rapid' && player.rapid_rating) {
    return `${rating} (R)`;
  } else if (timeControl === 'blitz' && player.blitz_rating) {
    return `${rating} (B)`;
  }
  
  return `${rating}`;
};
