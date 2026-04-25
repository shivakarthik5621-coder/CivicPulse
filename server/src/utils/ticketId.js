/**
 * Generate a unique ticket ID in the format CP-2026-XXXXX
 */
function generateTicketId() {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
  return `CP-${year}-${random}`;
}

module.exports = { generateTicketId };
