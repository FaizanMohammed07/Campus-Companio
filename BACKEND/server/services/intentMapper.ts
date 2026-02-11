import { z } from "zod";

const ResponseSchema = z.object({
  intent: z.enum(["NAVIGATE","GUIDE","BACK","HELP","STOP","FACULTY_TASK"]),
  target: z.enum(["A_BLOCK","B_BLOCK","ADMISSION","FEE","NONE"]).default("NONE"),
  ui_action: z.enum(["OPEN_PAGE","START_GUIDANCE","SHOW_INFO","GO_BACK"]).default("SHOW_INFO"),
  response_text: z.string().default("")
});

export type VoiceResponse = z.infer<typeof ResponseSchema>;

export function mapIntent(input: VoiceResponse): VoiceResponse {
  // Here we could enforce additional safety or normalization rules
  // e.g., if intent is STOP, force ui_action to GO_BACK
  if (input.intent === "STOP") {
    return { ...input, ui_action: "GO_BACK" };
  }
  return input;
}
