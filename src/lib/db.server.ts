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
`);

export interface Project {
	id: number;
	name: string;
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
export function createProject(name: string = 'New Project'): Project {
	const stmt = db.prepare('INSERT INTO projects (name) VALUES (?) RETURNING *');
	return stmt.get(name) as Project;
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
	const stmt = db.prepare('UPDATE projects SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
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
		INSERT INTO generations (project_id, title, style, lyrics, status)
		VALUES (?, ?, ?, ?, 'pending')
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
	const stmt = db.prepare('SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC');
	return stmt.all(projectId) as Generation[];
}

export function getLatestGenerationByProject(projectId: number): Generation | undefined {
	const stmt = db.prepare('SELECT * FROM generations WHERE project_id = ? ORDER BY created_at DESC LIMIT 1');
	return stmt.get(projectId) as Generation | undefined;
}

export function updateGenerationTaskId(id: number, taskId: string): void {
	const stmt = db.prepare('UPDATE generations SET task_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
	stmt.run(taskId, 'processing', id);
}

export function updateGenerationStatus(id: number, status: string, errorMessage?: string): void {
	const stmt = db.prepare('UPDATE generations SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
	stmt.run(status, errorMessage || null, id);
}

export function updateGenerationTracks(
	id: number,
	track1: { streamUrl?: string; audioUrl?: string; imageUrl?: string; duration?: number; audioId?: string },
	track2?: { streamUrl?: string; audioUrl?: string; imageUrl?: string; duration?: number; audioId?: string },
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
	track1: { streamUrl: string; audioUrl: string; imageUrl: string; duration: number; audioId: string },
	track2: { streamUrl: string; audioUrl: string; imageUrl: string; duration: number; audioId: string },
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
	const stmt = db.prepare("SELECT * FROM generations WHERE status IN ('pending', 'processing', 'text_success', 'first_success')");
	return stmt.all() as Generation[];
}

export default db;
