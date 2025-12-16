import type { Generation, StemSeparation } from '$lib/types';

// Store connected clients
const clients = new Map<string, ReadableStreamDefaultController<Uint8Array>>();

export function addClient(
	clientId: string,
	controller: ReadableStreamDefaultController<Uint8Array>
) {
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

export function notifyStemSeparationClients(
	stemSeparationId: number,
	generationId: number,
	audioId: string,
	type: 'stem_separation_update' | 'stem_separation_complete' | 'stem_separation_error',
	data: Partial<StemSeparation>
) {
	const message = JSON.stringify({ type, stemSeparationId, generationId, audioId, data });
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
