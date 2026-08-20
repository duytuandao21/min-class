import { z } from "zod";

export const ROOM_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
export const MSSV_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,31}$/;

export const roomIdSchema = z.string().uuid("Room không hợp lệ.");

export const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(ROOM_CODE_PATTERN, "Room Code phải gồm 6 ký tự hợp lệ.");

export const mssvSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(MSSV_PATTERN, "MSSV phải có 3–32 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.");
