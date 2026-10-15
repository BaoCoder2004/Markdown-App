import { toggleMarkdownTaskCheckbox } from './markdown-task.util';

describe('markdown-task.util', () => {
  it('should toggle an unchecked task to checked and wrap in strikethrough', () => {
    const md = '- [ ] Buy groceries\n- [ ] Walk the dog';
    const updated = toggleMarkdownTaskCheckbox(md, 0);
    expect(updated).toBe('- [x] ~~Buy groceries~~\n- [ ] Walk the dog');
  });

  it('should toggle a checked task to unchecked and unwrap strikethrough', () => {
    const md = '- [x] ~~Buy groceries~~\n- [ ] Walk the dog';
    const updated = toggleMarkdownTaskCheckbox(md, 0);
    expect(updated).toBe('- [ ] Buy groceries\n- [ ] Walk the dog');
  });

  it('should return null when checkbox index is out of bounds', () => {
    const md = '- [ ] Task 1';
    const updated = toggleMarkdownTaskCheckbox(md, 5);
    expect(updated).toBeNull();
  });

  it('should ignore checkboxes inside code blocks', () => {
    const md = '```\n- [ ] Code block task\n```\n- [ ] Real task';
    const updated = toggleMarkdownTaskCheckbox(md, 0);
    expect(updated).toBe('```\n- [ ] Code block task\n```\n- [x] ~~Real task~~');
  });
});

