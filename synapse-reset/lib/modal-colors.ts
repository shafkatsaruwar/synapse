import type { Theme } from "@/contexts/ThemeContext";

type ModalColorInput = Pick<Theme, "text">;

export function modalSurface(C: ModalColorInput) {
  return C.text === "#FFFFFF" ? "#1C1719" : "#FFFDF8";
}

export function modalSurfaceElevated(C: ModalColorInput) {
  return C.text === "#FFFFFF" ? "#282225" : "#F5F1EA";
}

export function modalOverlay() {
  return "rgba(0,0,0,0.68)";
}
