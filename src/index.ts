export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/send' && request.method === 'POST') {
			const body = await request.json<{ messages?: unknown[] }>();
			const messages = body.messages ?? [body];

			if (messages.length === 1) {
				await env.MY_QUEUE.send(messages[0]);
			} else {
				await env.MY_QUEUE.sendBatch(
					messages.map((msg) => ({ body: msg })),
				);
			}

			return Response.json({ success: true, messageCount: messages.length });
		}

		if (url.pathname === '/send' && request.method === 'GET') {
			await env.MY_QUEUE.send({ type: 'ping', timestamp: Date.now() });
			return Response.json({ success: true, message: 'Ping sent to queue' });
		}

		return new Response('Queue Test Worker\n\nGET /send  - send a ping message\nPOST /send - send custom message(s) via JSON body\n', {
			headers: { 'content-type': 'text/plain' },
		});
	},

	async queue(batch, env, ctx): Promise<void> {
		for (const message of batch.messages) {
			console.log(`Processing message ${message.id}:`, JSON.stringify(message.body));
			message.ack();
		}
	},
} satisfies ExportedHandler<Env>;
