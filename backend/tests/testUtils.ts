import type { FastifyReply } from 'fastify';

type ReplyPayload = {
  statusCode: number;
  payload: unknown;
  redirectedTo: string | null;
};

export function createReply() {
  const reply: FastifyReply & ReplyPayload = {
    statusCode: 200,
    payload: undefined,
    redirectedTo: null,
    code(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload?: unknown) {
      this.payload = payload;
      return this;
    },
    redirect(url: string) {
      this.redirectedTo = url;
      return this;
    },
  } as FastifyReply & ReplyPayload;

  return reply;
}
