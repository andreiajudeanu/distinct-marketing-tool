// Bottom sheet behaviour for the native <dialog>: two heights and drag to dismiss.

const CLOSE_DRAG_PX = 90;
const GROW_DRAG_PX = 40;

export function showSheet(sheet, html, detent = 'medium') {
  sheet.innerHTML = html;
  sheet.dataset.detent = detent;
  if (!sheet.open) sheet.showModal();
}

export function hideSheet(sheet) {
  if (sheet.open) sheet.close();
  sheet.innerHTML = '';
}

export function watchSheetDrag(sheet, onDismiss) {
  let startY = null;

  sheet.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.grabber')) return;
    startY = event.clientY;
    sheet.setPointerCapture(event.pointerId);
    sheet.classList.add('dragging');
  });

  sheet.addEventListener('pointermove', (event) => {
    if (startY === null) return;
    sheet.style.translate = `0 ${Math.max(0, event.clientY - startY)}px`;
  });

  const finish = (event) => {
    if (startY === null) return;
    const moved = event.clientY - startY;
    startY = null;
    sheet.classList.remove('dragging');
    sheet.style.translate = '';
    if (moved > CLOSE_DRAG_PX) onDismiss();
    else if (moved < -GROW_DRAG_PX) sheet.dataset.detent = 'large';
  };

  sheet.addEventListener('pointerup', finish);
  sheet.addEventListener('pointercancel', finish);
}
