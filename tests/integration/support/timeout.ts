export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function consumeStream(
  stream: AsyncIterable<string>,
  timeoutMs: number,
): Promise<void> {
  await withTimeout(
    (async () => {
      for await (const _chunk of stream) {
        // consume
      }
    })(),
    timeoutMs,
    "stream consume",
  );
}
