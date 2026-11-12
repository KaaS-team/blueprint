import { retry } from './retry.mjs';

export function upload(send, file) {
  return retry(() => send(file));
}
