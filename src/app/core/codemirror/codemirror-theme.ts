import { EditorView } from '@codemirror/view';
import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const customTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent !important',
    color: 'var(--text-main) !important',
  },
  '.cm-scroller': {
    lineHeight: '1.75',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
  },
  '.cm-content': {
    fontSize: '14.5px',
    caretColor: 'var(--editor-caret-color)',
    padding: '16px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent !important',
    color: 'var(--text-muted)',
    borderRight: 'none',
    opacity: '0.6',
    userSelect: 'none',
    paddingRight: '12px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent !important',
    color: 'var(--sidebar-active-text)',
    opacity: '1',
    fontWeight: '600',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(128, 128, 128, 0.04)',
    borderRadius: '4px',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selection-bg) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--editor-caret-color) !important',
    borderLeftWidth: '2px',
  },
  '.cm-code-meta': {
    color: 'var(--hl-meta) !important',
    fontSize: '12px',
    opacity: '0.8',
  },
  '.cm-math-dollar': {
    color: 'var(--hl-dollar) !important',
    fontWeight: '600',
    opacity: '0.85',
  },
  '.cm-md-hash': {
    color: 'var(--hl-hash) !important',
    fontWeight: '600',
    opacity: '0.6',
    marginRight: '4px',
  },
  '.cm-md-checkbox': {
    color: 'var(--hl-checkbox) !important',
    fontWeight: '600',
  },
  /* Tinh chỉnh tiêu đề trang nhã, không nhảy dòng thô kệch */
  '.cm-heading': {
    fontWeight: '600',
    color: 'var(--hl-heading)',
  },
  '.cm-heading-1': { fontSize: '1.3em' },
  '.cm-heading-2': { fontSize: '1.2em' },
  '.cm-heading-3': { fontSize: '1.12em' },
  '.cm-heading-4': { fontSize: '1.05em' },
  '.cm-heading-5': { fontSize: '1em' },
  '.cm-heading-6': { fontSize: '0.95em' },

  /* Search Panel Zen Styling */
  '.cm-panel.cm-search': {
    backgroundColor: 'var(--bg-menu) !important',
    color: 'var(--text-main) !important',
    borderBottom: '1px solid var(--border-color)',
    padding: '6px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    fontSize: '12px',
  },
  '.cm-panel.cm-search input': {
    backgroundColor: 'var(--bg-base) !important',
    color: 'var(--text-main) !important',
    border: '1px solid var(--border-color) !important',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    outline: 'none',
  },
  '.cm-panel.cm-search button': {
    backgroundColor: 'var(--bg-hover) !important',
    color: 'var(--text-main) !important',
    border: '1px solid var(--border-color) !important',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    margin: '0 2px',
  },
  '.cm-panel.cm-search button:hover': {
    color: 'var(--sidebar-active-text) !important',
  },
  '.cm-searchMatch': {
    backgroundColor: 'rgba(235, 175, 75, 0.35) !important',
    outline: '1px solid rgba(235, 175, 75, 0.6) !important',
    borderRadius: '2px',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'rgba(75, 145, 235, 0.45) !important',
    outline: '1px solid rgba(75, 145, 235, 0.8) !important',
  },

  /* Vim Status Panel & Fat Cursor Styling */
  '.cm-panel.cm-vim-panel': {
    backgroundColor: 'var(--bg-menu) !important',
    color: 'var(--text-main) !important',
    borderTop: '1px solid var(--border-color)',
    padding: '3px 12px',
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '.cm-panel.cm-vim-panel input': {
    backgroundColor: 'transparent !important',
    color: 'var(--text-main) !important',
    border: 'none !important',
    outline: 'none !important',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
  '.cm-fat-cursor': {
    position: 'absolute',
    background: 'var(--accent-color, #2e5b88) !important',
    opacity: '0.6',
    width: 'auto',
    border: 'none !important',
  },
  '&:not(.cm-focused) .cm-fat-cursor': {
    background: 'none !important',
    outline: 'solid 1px var(--text-muted) !important',
  },
});

export const inkdropHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: 'var(--hl-heading)', fontWeight: '600' },
  { tag: t.strong, fontWeight: '600', color: 'var(--hl-strong)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--hl-em)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--hl-del)', opacity: '0.7' },
  { tag: t.link, color: 'var(--hl-link)', textDecoration: 'underline', textUnderlineOffset: '3px' },
  { tag: t.url, color: 'var(--hl-link)', opacity: '0.85' },
  {
    tag: t.monospace,
    color: 'var(--hl-code)',
    backgroundColor: 'var(--bg-code)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
    fontSize: '0.9em',
  },
  { tag: t.comment, color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: t.meta, color: 'var(--hl-meta)' },
  { tag: t.punctuation, color: 'var(--hl-punct)', opacity: '0.75' },
  { tag: t.angleBracket, color: 'var(--hl-punct)', opacity: '0.75' },
  { tag: t.squareBracket, color: 'var(--hl-punct)', opacity: '0.75' },
  { tag: t.tagName, color: 'var(--hl-heading)', fontWeight: '600' },
  { tag: t.attributeName, color: 'var(--hl-property)' },
  { tag: t.attributeValue, color: 'var(--hl-string)' },
  { tag: t.documentMeta, color: 'var(--hl-meta)' },
  { tag: t.string, color: 'var(--hl-string)' },
  { tag: t.propertyName, color: 'var(--hl-property)' },
  { tag: t.keyword, color: 'var(--hl-keyword)', fontWeight: '500' },
  { tag: [t.number, t.bool, t.null], color: 'var(--hl-number)' },
  { tag: t.operator, color: 'var(--hl-operator)' },
  { tag: t.variableName, color: 'var(--text-main)' },
  { tag: t.definition(t.variableName), color: 'var(--hl-meta)' },
  { tag: t.function(t.variableName), color: 'var(--hl-function)' },
  { tag: t.definition(t.function(t.variableName)), color: 'var(--hl-function)', fontWeight: '600' },
  { tag: t.className, color: 'var(--hl-function)' },
  { tag: t.definition(t.typeName), color: 'var(--hl-keyword)' },
  { tag: t.typeName, color: 'var(--hl-keyword)' },
  { tag: [t.regexp, t.special(t.string)], color: 'var(--hl-code)' },
  { tag: t.escape, color: 'var(--hl-meta)' },
  { tag: t.invalid, color: 'var(--hl-del)', textDecoration: 'underline wavy' },
]);
