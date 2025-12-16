import type { Handle } from '@sveltejs/kit';
import { getPendingGenerations, getPendingStemSeparations } from '$lib/db.server';
import {
	recoverIncompleteGenerations,
	recoverIncompleteStemSeparations
} from '$lib/polling.server';

// Run recovery on server startup
const incompleteGenerations = getPendingGenerations();
recoverIncompleteGenerations(incompleteGenerations);

const incompleteStemSeparations = getPendingStemSeparations();
recoverIncompleteStemSeparations(incompleteStemSeparations);

export const handle: Handle = async ({ event, resolve }) => {
	return resolve(event);
};
