// MAIN FUNCTIONS -----------------------------------------------------------------------------

export function createOddsItem(odds, date, volume) {
  return { odds, date, volume };
}

export function createCompleteOddsItem(openingOddsItem, closingOddsItem) {
  return { opening: openingOddsItem, closing: closingOddsItem };
}
