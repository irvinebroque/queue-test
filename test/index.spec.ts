import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src/index';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('Queue Test Worker', () => {
	describe('fetch handler', () => {
		it('returns usage info on GET /', async () => {
			const response = await SELF.fetch('https://example.com/');
			expect(response.status).toBe(200);
			const text = await response.text();
			expect(text).toContain('Queue Test Worker');
			expect(text).toContain('/send');
		});

		it('sends a ping message on GET /send', async () => {
			const response = await SELF.fetch('https://example.com/send');
			expect(response.status).toBe(200);
			const json = await response.json<{ success: boolean; message: string }>();
			expect(json.success).toBe(true);
			expect(json.message).toBe('Ping sent to queue');
		});

		it('sends a single message on POST /send', async () => {
			const response = await SELF.fetch('https://example.com/send', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ data: 'hello' }),
			});
			expect(response.status).toBe(200);
			const json = await response.json<{ success: boolean; messageCount: number }>();
			expect(json.success).toBe(true);
			expect(json.messageCount).toBe(1);
		});

		it('sends a batch of messages on POST /send', async () => {
			const response = await SELF.fetch('https://example.com/send', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ messages: [{ id: 1 }, { id: 2 }, { id: 3 }] }),
			});
			expect(response.status).toBe(200);
			const json = await response.json<{ success: boolean; messageCount: number }>();
			expect(json.success).toBe(true);
			expect(json.messageCount).toBe(3);
		});
	});

	describe('queue consumer', () => {
		it('acknowledges all messages in a batch', async () => {
			const acks: string[] = [];
			const mockMessages = [
				{ id: 'msg-1', timestamp: new Date(), attempts: 1, body: { type: 'test', value: 1 }, ack: () => acks.push('msg-1'), retry: () => {} },
				{ id: 'msg-2', timestamp: new Date(), attempts: 1, body: { type: 'test', value: 2 }, ack: () => acks.push('msg-2'), retry: () => {} },
			];

			const mockBatch = {
				queue: 'queue-test-queue',
				messages: mockMessages,
				ackAll: () => {},
				retryAll: () => {},
			} as unknown as MessageBatch;

			const ctx = createExecutionContext();
			await worker.queue!(mockBatch, env, ctx);
			await waitOnExecutionContext(ctx);

			expect(acks).toEqual(['msg-1', 'msg-2']);
		});
	});
});
