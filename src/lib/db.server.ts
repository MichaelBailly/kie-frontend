import { Database } from 'bun:sqlite';
import { dev } from '$app/environment';

const db = new Database(dev ? 'kie-music.db' : '/data/kie-music.db');

// Enable WAL mode for better performance
db.exec('PRAGMA journal_mode = WAL');

// Initialize database schema
db.exec(`
	CREATE TABLE IF NOT EXISTS projects (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL DEFAULT 'New Project',
		is_open INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS generations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		project_id INTEGER NOT NULL,
		task_id TEXT,
		title TEXT NOT NULL,
		style TEXT NOT NULL,
		lyrics TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'pending',
		error_message TEXT,
		track1_stream_url TEXT,
		track1_audio_url TEXT,
		track1_image_url TEXT,
		track1_duration REAL,
		track2_stream_url TEXT,
		track2_audio_url TEXT,
		track2_image_url TEXT,
		track2_duration REAL,
		track1_audio_id TEXT,
		track2_audio_id TEXT,
		response_data TEXT,
		-- Extend song tracking
		extends_generation_id INTEGER,
		extends_audio_id TEXT,
		continue_at REAL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
		FOREIGN KEY (extends_generation_id) REFERENCES generations(id) ON DELETE SET NULL
	);

	CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id);
	CREATE INDEX IF NOT EXISTS idx_generations_task_id ON generations(task_id);
	CREATE INDEX IF NOT EXISTS idx_generations_extends ON generations(extends_generation_id);

	CREATE TABLE IF NOT EXISTS stem_separations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		generation_id INTEGER NOT NULL,
		audio_id TEXT NOT NULL,
		task_id TEXT,
		type TEXT NOT NULL CHECK (type IN ('separate_vocal', 'split_stem')),
		status TEXT NOT NULL DEFAULT 'pending',
		error_message TEXT,
		-- separate_vocal results
		vocal_url TEXT,
		instrumental_url TEXT,
		-- split_stem results
		backing_vocals_url TEXT,
		drums_url TEXT,
		bass_url TEXT,
		guitar_url TEXT,
		keyboard_url TEXT,
		piano_url TEXT,
		percussion_url TEXT,
		strings_url TEXT,
		synth_url TEXT,
		fx_url TEXT,
		brass_url TEXT,
		woodwinds_url TEXT,
		response_data TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_stem_separations_generation_audio ON stem_separations(generation_id, audio_id);
	CREATE INDEX IF NOT EXISTS idx_stem_separations_task_id ON stem_separations(task_id);
`);

// Migration: Add is_open column to existing projects table
try {
	db.exec(`ALTER TABLE projects ADD COLUMN is_open INTEGER NOT NULL DEFAULT 0`);
	// Set all existing projects as open for backwards compatibility
	db.exec(`UPDATE projects SET is_open = 1`);
} catch {
	// Column already exists, ignore error
}

export interface Project {
	id: number;
	name: string;
	is_open: boolean;
	created_at: string;
	updated_at: string;
}

export interface Generation {
	id: number;
	project_id: number;
	task_id: string | null;
	title: string;
	style: string;
	lyrics: string;
	status: string;
	error_message: string | null;
	track1_stream_url: string | null;
	track1_audio_url: string | null;
	track1_image_url: string | null;
	track1_duration: number | null;
	track2_stream_url: string | null;
	track2_audio_url: string | null;
	track2_image_url: string | null;
	track2_duration: number | null;
	track1_audio_id: string | null;
	track2_audio_id: string | null;
	response_data: string | null;
	extends_generation_id: number | null;
	extends_audio_id: string | null;
	continue_at: number | null;
	created_at: string;
	updated_at: string;
}

// Project operations
export function createProject(name: string = 'New Project', isOpen: boolean = true): Project {
	const stmt = db.prepare('INSERT INTO projects (name, is_open) VALUES (?, ?) RETURNING *');
	return stmt.get(name, isOpen ? 1 : 0) as Project;
}

export function getOpenProjects(): Project[] {
	const stmt = db.prepare('SELECT * FROM projects WHERE is_open = 1 ORDER BY updated_at DESC');
	return stmt.all() as Project[];
}

export function setProjectOpen(id: number, isOpen: boolean): void {
	const stmt = db.prepare(
		'UPDATE projects SET is_open = ? WHERE id = ?'
	);
	stmt.run(isOpen ? 1 : 0, id);
}

export function getProject(id: number): Project | undefined {
	const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
	return stmt.get(id) as Project | undefined;
}

export function getAllProjects(): Project[] {
	const stmt = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
	return stmt.all() as Project[];
}

export function updateProjectName(id: number, name: string): void {
	const stmt = db.prepare(
		'UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	);
	stmt.run(name, id);
}

export function deleteProject(id: number): void {
	const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
	stmt.run(id);
}

// Generation operations
export function createGeneration(
	projectId: number,
	title: string,
	style: string,
	lyrics: string
): Generation {
	const stmt = db.prepare(`
		INSERT INTO generations (project_id, title, style, lyrics, status, extends_generation_id, extends_audio_id, continue_at)
		VALUES (?, ?, ?, ?, 'pending', NULL, NULL, NULL)
		RETURNING *
	`);
	const generation = stmt.get(projectId, title, style, lyrics) as Generation;

	// Update project's updated_at
	db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

	return generation;
}

export function createExtendGeneration(
	projectId: number,
	title: string,
	style: string,
	lyrics: string,
	extendsGenerationId: number,
	extendsAudioId: string,
	continueAt: number
): Generation {
	const stmt = db.prepare(`
		INSERT INTO generations (project_id, title, style, lyrics, status, extends_generation_id, extends_audio_id, continue_at)
		VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
		RETURNING *
	`);
	const generation = stmt.get(
		projectId,
		title,
		style,
		lyrics,
		extendsGenerationId,
		extendsAudioId,
		continueAt
	) as Generation;

	// Update project's updated_at
	db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

	return generation;
}

export function getExtendedGenerations(generationId: number, audioId: string): Generation[] {
	const stmt = db.prepare(`
		SELECT * FROM generations 
		WHERE extends_generation_id = ? AND extends_audio_id = ?
		ORDER BY created_at ASC
	`);
	return stmt.all(generationId, audioId) as Generation[];
}

export function getGeneration(id: number): Generation | undefined {
	const stmt = db.prepare('SELECT * FROM generations WHERE id = ?');
	return stmt.get(id) as Generation | undefined;
}

export function getGenerationByTaskId(taskId: string): Generation | undefined {
	const stmt = db.prepare('SELECT * FROM generations WHERE task_id = ?');
	return stmt.get(taskId) as Generation | undefined;
}

export function getGenerationsByProject(projectId: number): Generation[] {
	const stmt = db.prepare(
		'SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC'
	);
	return stmt.all(projectId) as Generation[];
}

export function getLatestGenerationByProject(projectId: number): Generation | undefined {
	const stmt = db.prepare(
		'SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1'
	);
	return stmt.get(projectId) as Generation | undefined;
}

export function updateGenerationTaskId(id: number, taskId: string): void {
	const stmt = db.prepare(
		'UPDATE generations SET task_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	);
	stmt.run(taskId, 'processing', id);
}

export function updateGenerationStatus(id: number, status: string, errorMessage?: string): void {
	const stmt = db.prepare(
		'UPDATE generations SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
	);
	stmt.run(status, errorMessage || null, id);
}

export function updateGenerationTracks(
	id: number,
	track1: {
		streamUrl?: string;
		audioUrl?: string;
		imageUrl?: string;
		duration?: number;
		audioId?: string;
	},
	track2?: {
		streamUrl?: string;
		audioUrl?: string;
		imageUrl?: string;
		duration?: number;
		audioId?: string;
	},
	responseData?: string
): void {
	const stmt = db.prepare(`
		UPDATE generations SET
			track1_stream_url = COALESCE(?, track1_stream_url),
			track1_audio_url = COALESCE(?, track1_audio_url),
			track1_image_url = COALESCE(?, track1_image_url),
			track1_duration = COALESCE(?, track1_duration),
			track1_audio_id = COALESCE(?, track1_audio_id),
			track2_stream_url = COALESCE(?, track2_stream_url),
			track2_audio_url = COALESCE(?, track2_audio_url),
			track2_image_url = COALESCE(?, track2_image_url),
			track2_duration = COALESCE(?, track2_duration),
			track2_audio_id = COALESCE(?, track2_audio_id),
			response_data = COALESCE(?, response_data),
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`);
	stmt.run(
		track1.streamUrl || null,
		track1.audioUrl || null,
		track1.imageUrl || null,
		track1.duration || null,
		track1.audioId || null,
		track2?.streamUrl || null,
		track2?.audioUrl || null,
		track2?.imageUrl || null,
		track2?.duration || null,
		track2?.audioId || null,
		responseData || null,
		id
	);
}

export function completeGeneration(
	id: number,
	status: string,
	track1: {
		streamUrl: string;
		audioUrl: string;
		imageUrl: string;
		duration: number;
		audioId: string;
	},
	track2: {
		streamUrl: string;
		audioUrl: string;
		imageUrl: string;
		duration: number;
		audioId: string;
	},
	responseData: string
): void {
	const stmt = db.prepare(`
		UPDATE generations SET
			status = ?,
			track1_stream_url = ?,
			track1_audio_url = ?,
			track1_image_url = ?,
			track1_duration = ?,
			track1_audio_id = ?,
			track2_stream_url = ?,
			track2_audio_url = ?,
			track2_image_url = ?,
			track2_duration = ?,
			track2_audio_id = ?,
			response_data = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`);
	stmt.run(
		status,
		track1.streamUrl,
		track1.audioUrl,
		track1.imageUrl,
		track1.duration,
		track1.audioId,
		track2.streamUrl,
		track2.audioUrl,
		track2.imageUrl,
		track2.duration,
		track2.audioId,
		responseData,
		id
	);
}

export function deleteGeneration(id: number): void {
	const stmt = db.prepare('DELETE FROM generations WHERE id = ?');
	stmt.run(id);
}

export function getPendingGenerations(): Generation[] {
	const stmt = db.prepare(
		"SELECT * FROM generations WHERE status IN ('pending', 'processing', 'text_success', 'first_success')"
	);
	return stmt.all() as Generation[];
}

export function createImportedGeneration(
	projectId: number,
	taskId: string,
	title: string,
	style: string,
	lyrics: string,
	track1: {
		streamUrl: string;
		audioUrl: string;
		imageUrl: string;
		duration: number;
		audioId: string;
	},
	track2: {
		streamUrl: string;
		audioUrl: string;
		imageUrl: string;
		duration: number;
		audioId: string;
	},
	responseData: string
): Generation {
	const stmt = db.prepare(`
		INSERT INTO generations (
			project_id, task_id, title, style, lyrics, status,
			track1_stream_url, track1_audio_url, track1_image_url, track1_duration, track1_audio_id,
			track2_stream_url, track2_audio_url, track2_image_url, track2_duration, track2_audio_id,
			response_data
		) VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		RETURNING *
	`);
	const generation = stmt.get(
		projectId,
		taskId,
		title,
		style,
		lyrics,
		track1.streamUrl,
		track1.audioUrl,
		track1.imageUrl,
		track1.duration,
		track1.audioId,
		track2.streamUrl,
		track2.audioUrl,
		track2.imageUrl,
		track2.duration,
		track2.audioId,
		responseData
	) as Generation;

	// Update project's updated_at
	db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(projectId);

	return generation;
}

// Stem Separation types and operations
export type StemSeparationType = 'separate_vocal' | 'split_stem';

export interface StemSeparation {
	id: number;
	generation_id: number;
	audio_id: string;
	task_id: string | null;
	type: StemSeparationType;
	status: string;
	error_message: string | null;
	vocal_url: string | null;
	instrumental_url: string | null;
	backing_vocals_url: string | null;
	drums_url: string | null;
	bass_url: string | null;
	guitar_url: string | null;
	keyboard_url: string | null;
	piano_url: string | null;
	percussion_url: string | null;
	strings_url: string | null;
	synth_url: string | null;
	fx_url: string | null;
	brass_url: string | null;
	woodwinds_url: string | null;
	response_data: string | null;
	created_at: string;
	updated_at: string;
}

export function createStemSeparation(
	generationId: number,
	audioId: string,
	type: StemSeparationType
): StemSeparation {
	const stmt = db.prepare(`
		INSERT INTO stem_separations (generation_id, audio_id, type, status)
		VALUES (?, ?, ?, 'pending')
		RETURNING *
	`);
	return stmt.get(generationId, audioId, type) as StemSeparation;
}

export function getStemSeparation(id: number): StemSeparation | undefined {
	const stmt = db.prepare('SELECT * FROM stem_separations WHERE id = ?');
	return stmt.get(id) as StemSeparation | undefined;
}

export function getStemSeparationByTaskId(taskId: string): StemSeparation | undefined {
	const stmt = db.prepare('SELECT * FROM stem_separations WHERE task_id = ?');
	return stmt.get(taskId) as StemSeparation | undefined;
}

export function getStemSeparationsForSong(generationId: number, audioId: string): StemSeparation[] {
	const stmt = db.prepare(`
		SELECT * FROM stem_separations 
		WHERE generation_id = ? AND audio_id = ?
		ORDER BY created_at DESC
	`);
	return stmt.all(generationId, audioId) as StemSeparation[];
}

export function getStemSeparationByType(
	generationId: number,
	audioId: string,
	type: StemSeparationType
): StemSeparation | undefined {
	const stmt = db.prepare(`
		SELECT * FROM stem_separations 
		WHERE generation_id = ? AND audio_id = ? AND type = ?
		ORDER BY created_at DESC
		LIMIT 1
	`);
	return stmt.get(generationId, audioId, type) as StemSeparation | undefined;
}

export function updateStemSeparationTaskId(id: number, taskId: string): void {
	const stmt = db.prepare(`
		UPDATE stem_separations 
		SET task_id = ?, status = 'processing', updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`);
	stmt.run(taskId, id);
}

export function updateStemSeparationStatus(
	id: number,
	status: string,
	errorMessage?: string
): void {
	const stmt = db.prepare(`
		UPDATE stem_separations 
		SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
		WHERE id = ?
	`);
	stmt.run(status, errorMessage || null, id);
}

export function completeStemSeparation(
	id: number,
	data: {
		vocalUrl?: string;
		instrumentalUrl?: string;
		backingVocalsUrl?: string;
		drumsUrl?: string;
		bassUrl?: string;
		guitarUrl?: string;
		keyboardUrl?: string;
		pianoUrl?: string;
		percussionUrl?: string;
		stringsUrl?: string;
		synthUrl?: string;
		fxUrl?: string;
		brassUrl?: string;
		woodwindsUrl?: string;
	},
	responseData: string
): void {
	const stmt = db.prepare(`
		UPDATE stem_separations SET
			status = 'success',
			vocal_url = ?,
			instrumental_url = ?,
			backing_vocals_url = ?,
			drums_url = ?,
			bass_url = ?,
			guitar_url = ?,
			keyboard_url = ?,
			piano_url = ?,
			percussion_url = ?,
			strings_url = ?,
			synth_url = ?,
			fx_url = ?,
			brass_url = ?,
			woodwinds_url = ?,
			response_data = ?,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`);
	stmt.run(
		data.vocalUrl || null,
		data.instrumentalUrl || null,
		data.backingVocalsUrl || null,
		data.drumsUrl || null,
		data.bassUrl || null,
		data.guitarUrl || null,
		data.keyboardUrl || null,
		data.pianoUrl || null,
		data.percussionUrl || null,
		data.stringsUrl || null,
		data.synthUrl || null,
		data.fxUrl || null,
		data.brassUrl || null,
		data.woodwindsUrl || null,
		responseData,
		id
	);
}

export function getPendingStemSeparations(): StemSeparation[] {
	const stmt = db.prepare(
		"SELECT * FROM stem_separations WHERE status IN ('pending', 'processing')"
	);
	return stmt.all() as StemSeparation[];
}

export default db;
