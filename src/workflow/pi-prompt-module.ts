import type {
  CompiledPrompt,
  DynamicContent,
  DynamicElement,
  PromptModule,
} from "@modular-prompt/core";

/** Pi Context を agenticProcess に渡すための最小 PromptModule */
export interface PiAgenticContext {
  compiled: CompiledPrompt;
}

const instructionsFromCompiled: DynamicContent<PiAgenticContext> = (context) =>
  context.compiled.instructions as DynamicElement[];

const messagesFromCompiled: DynamicContent<PiAgenticContext> = (context) =>
  context.compiled.data as DynamicElement[];

export const piAgenticModule: PromptModule<PiAgenticContext> = {
  instructions: [instructionsFromCompiled],
  messages: [messagesFromCompiled],
};
