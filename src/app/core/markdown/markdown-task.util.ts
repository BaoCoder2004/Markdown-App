/**
 * Toggles the checkbox state of a markdown task list item at the given 0-based checkbox index.
 * Returns the updated markdown string, or null if no change was made.
 */
export function toggleMarkdownTaskCheckbox(content: string, targetIndex: number): string | null {
  let matchCount = 0;
  const regex = /(```[\s\S]*?```)|^([ \t]*(?:[-*+]|\d+\.)[ \t]+\[)([ xX])(\][ \t]*)(.*)$/gm;

  const newContent = content.replace(
    regex,
    (match, codeBlock, prefix, checkState, checkboxEnd, taskText) => {
      if (codeBlock) return match;
      if (matchCount === targetIndex) {
        matchCount++;
        const newState = checkState === ' ' ? 'x' : ' ';
        const leadingSpace = taskText.match(/^\s*/)?.[0] ?? '';
        const trailingSpace = taskText.match(/\s*$/)?.[0] ?? '';
        let taskBody = taskText.slice(leadingSpace.length, taskText.length - trailingSpace.length);

        if (taskBody) {
          if (newState === 'x' && !/^~~[\s\S]+~~$/.test(taskBody)) {
            taskBody = `~~${taskBody}~~`;
          } else if (newState === ' ' && /^~~[\s\S]+~~$/.test(taskBody)) {
            taskBody = taskBody.slice(2, -2);
          }
        }

        return `${prefix}${newState}${checkboxEnd}${leadingSpace}${taskBody}${trailingSpace}`;
      }
      matchCount++;
      return match;
    }
  );

  return newContent !== content ? newContent : null;
}

