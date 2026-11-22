export const overviewFrame = { scale: 1, center: .5, lift: 0 };
export const readingZoomDuration = 1500;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Use the same breakpoint as the book's mobile typography. The viewport,
// rather than the user agent or the screen orientation API, determines the fit.
export const isPortraitBook = (width, height) => width < 700 && height > width;

export function clampReadingCenter(center, visible) {
  const edge = clamp(visible / 2 - .02, 0, .5);
  return clamp(center, edge, 1 - edge);
}

export function readingFrame(width, height, pageWidth, pageHeight, view, previous) {
  if (!isPortraitBook(width, height) || !view?.chapter) return overviewFrame;
  const span = view.chapter === 'workshop' ? .60 : .62;
  const scale = Math.max(1, Math.min(width / (pageWidth * span), (height - 190) / pageHeight));
  if (scale === 1) return overviewFrame;

  const visible = width / (pageWidth * scale);
  if (view.center != null) return { scale, center: clampReadingCenter(view.center, visible), lift: 26 };
  let center = .5;
  if (view.chapter === 'text') center = Math.max(.5, 1.025 - visible / 2);
  if (view.chapter === 'workshop') {
    const subject = view.subject ?? .5;
    const deadZone = visible * .10;
    center = view.instant ? subject : clamp(previous.center, subject - deadZone, subject + deadZone);

    // Keep the object within the frame once it and the guide fit together.
    if (view.object) {
      const left = Math.min(subject, view.object[0]);
      const right = Math.max(subject, view.object[1]);
      const half = visible * .45;
      if (right - left <= half * 2) center = clamp(center, right - half, left + half);
    }
    center = clampReadingCenter(center, visible);
  }
  return { scale, center, lift: 26 };
}

export function zoomReadingFrame(from, target, progress) {
  if (progress === 1) return target;
  // Accelerate through most of the move, then ease into the final framing.
  const peak = .8;
  const amount = progress < peak
    ? progress ** 2 / peak
    : 1 - (1 - progress) ** 2 / (1 - peak);
  return {
    scale: from.scale + (target.scale - from.scale) * amount,
    center: from.center + (target.center - from.center) * amount,
    lift: from.lift + (target.lift - from.lift) * amount,
  };
}

export function followReadingFrame(current, target, elapsed) {
  const distance = target.center - current.center;
  if (Math.abs(distance) < .0009) return target;
  return { ...target, center: current.center + distance * (1 - Math.exp(-elapsed / 105)) };
}
