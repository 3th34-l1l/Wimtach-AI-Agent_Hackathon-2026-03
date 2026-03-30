/**
 * Utility functions for email extraction from chat messages
 */

export function extractEmailsFromText(text: string): string[] {
  if (!text) return [];
  
  // Email regex pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailPattern) || [];
  
  // Filter out duplicates and invalid patterns
  const emails = Array.from(new Set(matches)).filter((email) => {
    // Exclude common false positives
    return !email.includes("example") && !email.includes("test");
  });
  
  return emails;
}

export function extractEmailsFromMessages(messages: { role: string; text: string }[]): string[] {
  const allEmails = new Set<string>();
  
  // Search through all messages (preferring user messages, but check AI too)
  const reversedMsgs = [...messages].reverse();
  
  for (const msg of reversedMsgs) {
    const emails = extractEmailsFromText(msg.text);
    emails.forEach((email) => allEmails.add(email));
    
    // If we found emails, stop searching older messages
    if (allEmails.size > 0) {
      break;
    }
  }
  
  return Array.from(allEmails);
}

export function validateEmails(emails: string[]): string[] {
  return emails.filter((email) => {
    // Basic validation
    const parts = email.split("@");
    if (parts.length !== 2) return false;
    if (parts[0].length === 0 || parts[1].length === 0) return false;
    return true;
  });
}
