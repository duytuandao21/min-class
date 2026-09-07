import "client-only";

const STORAGE_PREFIX = "minclass:course-section-student:";

function storageKey(courseSectionId: string): string {
  return `${STORAGE_PREFIX}${courseSectionId}`;
}

export function getRememberedCourseSectionMssv(courseSectionId: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(courseSectionId));
  } catch {
    return null;
  }
}

export function rememberCourseSectionMssv(courseSectionId: string, mssv: string): void {
  try {
    window.sessionStorage.setItem(storageKey(courseSectionId), mssv.trim().toUpperCase());
  } catch {
    // Access still works for the current request when browser storage is unavailable.
  }
}

export function forgetCourseSectionMssv(courseSectionId: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(courseSectionId));
  } catch {
    // There is no persisted value to clear when browser storage is unavailable.
  }
}
