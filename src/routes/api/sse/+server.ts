import type { RequestHandler } from './$types';
import { addClient, removeClient } from '$lib/sse.server';

export const GET: RequestHandler = async () => {
	const clientId = crypto.randomUUID();

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			addClient(clientId, controller);

			// Send initial connection message
			const encoder = new TextEncoder();
			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`));
		},
		cancel() {
			removeClient(clientId);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
