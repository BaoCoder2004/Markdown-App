export interface TagStyle {
  background: string;
  borderColor: string;
  color: string;
}

// Bảng màu lấy cảm hứng từ các sắc thái tự nhiên Nhật Bản (Sakura, Matcha, Aizome, Yamabuki, Fuji, Asagi)
export const TAG_PALETTE: TagStyle[] = [
  { background: 'rgba(59, 110, 78, 0.12)', borderColor: 'rgba(59, 110, 78, 0.28)', color: '#2f543d' },  /* Matcha */
  { background: 'rgba(43, 97, 148, 0.12)', borderColor: 'rgba(43, 97, 148, 0.28)', color: '#2b6194' }, /* Aizome / Chàm */
  { background: 'rgba(163, 90, 100, 0.12)', borderColor: 'rgba(163, 90, 100, 0.28)', color: '#914953' },/* Sakura / Azuki */
  { background: 'rgba(111, 82, 138, 0.12)', borderColor: 'rgba(111, 82, 138, 0.28)', color: '#5e4375' },/* Fuji / Hoa tử đằng */
  { background: 'rgba(133, 97, 60, 0.12)', borderColor: 'rgba(133, 97, 60, 0.28)', color: '#7a542b' },  /* Yamabuki / Gỗ thông */
  { background: 'rgba(54, 96, 82, 0.12)', borderColor: 'rgba(54, 96, 82, 0.28)', color: '#284c40' },   /* Asagi / Xanh ngọc cổ */
];

export function getTagStyle(tag: string, palette = TAG_PALETTE): TagStyle {
  const hash = Array.from(tag).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const index = Math.abs(hash) % palette.length;
  return palette[index];
}
