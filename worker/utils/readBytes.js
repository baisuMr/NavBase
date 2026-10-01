// 流式读取响应体（favicon / pageMeta 共用）：
// 只读前 maxBytes 字节、提前取消剩余流，防异常大响应或慢速滴流拖住内存；
// 返回已读字节的 Uint8Array，长度可能略超 maxBytes（最后一块整块计入），由调用方按需判定

// 把 abort 事件转成可与 reader.read() 竞速的 rejected promise（信号触发时让读取立即失败）
export function abortPromise(signal) {
  return new Promise((_, reject) => {
    if (!signal) return;
    if (signal.aborted) return reject(new Error('已取消'));
    signal.addEventListener('abort', () => reject(new Error('已取消')), { once: true });
  });
}

export async function readBytes(res, maxBytes, signal) {
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    while (received <= maxBytes) {
      const { done, value } = await Promise.race([reader.read(), abortPromise(signal)]);
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const all = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return all;
}
