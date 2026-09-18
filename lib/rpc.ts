import { browser } from 'wxt/browser';
import { AppError, connectionError, type Reply, type Request } from './messages';
export async function rpc<T>(message: Request): Promise<T> {
  let reply: Reply<T>;
  try { reply = await browser.runtime.sendMessage(message); } catch {
    throw new AppError(connectionError());
  }
  if (!reply) throw new AppError(connectionError());
  if (!reply.ok) throw new AppError(reply.error);
  return reply.data;
}
