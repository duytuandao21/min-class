import {
  commentBodySchema,
  parseCommentResult,
  parseReactionResult,
  parseTeacherFeedbackSnapshot,
  reactionSchema,
  type Reaction,
  type TeacherFeedbackSnapshot,
} from "@/features/rooms/feedback";
import { roomIdSchema } from "@/features/rooms/schemas";
import { createClient } from "@/lib/supabase/client";

export async function setSectionReaction(sectionIdInput: string, reactionInput: Reaction) {
  const sectionId = roomIdSchema.parse(sectionIdInput);
  const reaction = reactionSchema.parse(reactionInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_section_reaction", {
    p_section_id: sectionId,
    p_reaction: reaction,
  });
  if (error) throw new Error("Không thể lưu reaction. Hãy thử lại.");
  return parseReactionResult(data);
}

export async function createSectionComment(
  sectionIdInput: string,
  bodyInput: string,
  isAnonymous: boolean,
) {
  const sectionId = roomIdSchema.parse(sectionIdInput);
  const body = commentBodySchema.parse(bodyInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_section_comment", {
    p_section_id: sectionId,
    p_body: body,
    p_is_anonymous: isAnonymous,
  });
  if (error) throw new Error("Không thể gửi comment. Hãy thử lại.");
  return parseCommentResult(data);
}

export async function fetchTeacherFeedbackSnapshot(
  roomIdInput: string,
): Promise<TeacherFeedbackSnapshot> {
  const roomId = roomIdSchema.parse(roomIdInput);
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_teacher_feedback_snapshot", {
    p_room_id: roomId,
  });
  if (error) throw new Error("Không thể đồng bộ Live Feedback.");
  return parseTeacherFeedbackSnapshot(data);
}
