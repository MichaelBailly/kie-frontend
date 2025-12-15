import type { Generation } from '$lib/types';

// Store connected clients
const clients = new Map<string, ReadableStreamDefaultController<Uint8Array>>();

export function addClient(clientId: string, controller: ReadableStreamDefaultController<Uint8Array>) {
	clients.set(clientId, controller);
}

export function removeClient(clientId: string) {
	clients.delete(clientId);
}

export function notifyClients(
	generationId: number,
	type: 'generation_update' | 'generation_complete' | 'generation_error',
	data: Partial<Generation>
) {
	const message = JSON.stringify({ type, generationId, data });
	const encoder = new TextEncoder();
	const eventData = encoder.encode(`data: ${message}\n\n`);

	for (const [clientId, controller] of clients.entries()) {
		try {
			controller.enqueue(eventData);
		} catch {
			// Client disconnected, clean up
			clients.delete(clientId);
		}
	}
}
