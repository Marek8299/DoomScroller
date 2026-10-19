/**
 * Copies text to the clipboard; resolves to whether it worked.
 *
 * The modern API needs a secure context (https or localhost) and can be refused by permissions,
 * so there's a fallback to the old select-and-copy trick, which still works on plain http
 * (e.g. testing from a phone against a LAN address).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed'; // off to the side, so selecting it doesn't scroll the page
  area.style.opacity = '0';
  document.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
