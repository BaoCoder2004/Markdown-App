export function getSnippet(content?: string, maxLength = 40): string {
  if (!content) return 'No content';
  const plainText = content.replace(/[#*`_>[\]]/g, '').trim();
  return plainText.length > maxLength ? `${plainText.substring(0, maxLength)}...` : plainText;
}

