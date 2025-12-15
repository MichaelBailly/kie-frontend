import type { Handle } from '@sveltejs/kit';
import { getPendingGenerations } from '$lib/db.server';
import { recoverIncompleteGenerations } from '$lib/polling.server';

// Run recovery on server startup
const incompleteGenerations = getPendingGenerations();
recoverIncompleteGenerations(incompleteGenerations);

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
