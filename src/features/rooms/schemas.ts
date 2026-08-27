import { z } from "zod";

export const MSSV_PATTERN = /^[A-Z0-9][A-Z0-9._-]{2,31}$/;

export const roomIdSchema = z.string().uuid("Room không hợp lệ.");

export const mssvSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(MSSV_PATTERN, "MSSV phải có 3–32 ký tự chữ, số, dấu chấm, gạch ngang hoặc gạch dưới.");
