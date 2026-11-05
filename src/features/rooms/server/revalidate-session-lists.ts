import { revalidatePath } from "next/cache";

export function revalidateChapterSessionLists() {
  revalidatePath("/teacher/subjects");
  revalidatePath("/teacher/subjects/[subjectId]/sections/[courseSectionId]", "page");
  revalidatePath("/teacher/rooms/[roomId]", "page");
  revalidatePath("/learn/live");
  revalidatePath("/learn/subjects/[subjectId]/sections/[courseSectionId]", "page");
}
