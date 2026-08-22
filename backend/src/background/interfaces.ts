import type { SetOptional } from 'type-fest'

export interface Playlist {
	/** Id of the playlist. */
	id: string
	/** Name of the playlist */
	name: string
}

export type MutationPlaylistCreate = SetOptional<Playlist, 'id'>

export type MutationPlaylistRead = SetOptional<Pick<Playlist, 'id'>, 'id'>

export type MutationPlaylistUpdate = Playlist

export type MutationPlaylistDelete = Pick<Playlist, 'id'>

/** Base payload value type */
export type PayloadValue = string | number | boolean | undefined
/** Generic payload container */
export interface IHasPayload<TPayload extends Record<string, any> = Record<string, PayloadValue>> {
	/** User configurable fields */
	payload: TPayload
}

export interface Rundown extends IHasPayload {
	/** Id of the rundown as reported by the ingest gateway. Must be unique for each rundown owned by the gateway */
	id: string
	/** id of the playlist this rundown is in */
	playlistId: string | null
	/** Name of the rundown */
	name: string
	/** Whether to sync the rundown to Sofie */
	sync: boolean
	/** Flags the rundown as template. Template rundowns cannot sync to Sofie. */
	isTemplate: boolean

	/** Date of when the rundown is supposed to start */
	expectedStartTime?: number
	/** Date of when the rundown is supposed to end */
	expectedEndTime?: number

	/** Daily-generation attempt id stamped when cloned from the daily template flow. */
	attemptId?: string
	/** Durable idempotency key linking this rundown to a dailyGenerations reservation. */
	idempotencyKey?: string
}
export interface Segment extends IHasPayload {
	/** Id of the segment as reported by the ingest gateway. Must be unique for each segment in the rundown */
	id: string
	/** Id of the playlist this segment belongs to */
	playlistId: string | null
	/** Id of the rundown this segment belongs to */
	rundownId: string
	/** Name of the segment */
	name: string
	/** Rank of the segment within the rundown */
	rank: number
	/** Whether this segment is floated */
	float: boolean
	/** Flags the segment as template. Template segments can be selected individually to be imported into other rundowns. */
	isTemplate: boolean

	segmentType: string
}

export interface Part extends IHasPayload {
	/** Id of the part as reported by the ingest gateway. Must be unique for each part in the rundown */
	id: string
	/** Id of the playlist this part belongs to */
	playlistId: string | null
	/** Id of the rundown this part belongs to */
	rundownId: string
	/** Id of the segment this part belongs to */
	segmentId: string
	/** Name of the part */
	name: string
	/** Rank of the part within the segmetn */
	rank: number
	/** Whether this part is floated */
	float: boolean
	/**
	 * Editorial skip: faded in UI, excluded from timing, and omitted from Sofie like float.
	 * Distinct from `float` so operators can mark intentional skips with status semantics.
	 */
	skip?: boolean
	/** Manually confirmed by an editor (gate for on-air when settings require it). */
	editorChecked?: boolean

	script?: string
	duration?: number
	partType: string
	/** True when the part was created from a part-type preset button */
	fromPreset?: boolean
}
export interface Piece extends IHasPayload {
	/** Id of the adlib as reported by the ingest source. Must be unique for each adlib */
	id: string
	/** Id of the playlist this piece belongs to */
	playlistId: string | null
	/** Id of the rundown this piece belongs to */
	rundownId: string
	/** Id of the segment this piece belongs to */
	segmentId: string
	/** Id of the part this piece belongs to */
	partId: string
	/** Name of the piece */
	name: string

	start?: number
	duration?: number // todo - timing type for infintes
	rank?: number

	pieceType: string
	/** Editorial skip: faded, excluded from story length and Sofie export. */
	skip?: boolean
	/** Manually confirmed by an editor for this piece. */
	editorChecked?: boolean
}

export interface DBPlaylist {
	document: string // Omit<Playlist, 'id'>
	id: string
}
export interface DBRundown {
	document: string // Omit<Rundown, 'id'>
	id: string
	playlistId?: string
}
export interface DBSegment {
	document: string // Omit<Segment, 'id'>
	id: string
	playlistId?: string
	rundownId: string
}
export interface DBPart {
	document: string // Omit<Part, 'id'>
	id: string
	playlistId?: string
	rundownId: string
	segmentId: string
}
export interface DBPiece {
	document: string // Omit<Piece, 'id'>
	id: string
	playlistId?: string
	rundownId: string
	segmentId: string
	partId: string
}

export enum ManifestFieldType {
	String = 'string',
	Number = 'number',
	Boolean = 'boolean',
	MediaPick = 'mediaPick'
}
export enum TypeManifestEntity {
	Rundown = 'rundown',
	Segment = 'segment',
	Part = 'part',
	Piece = 'piece'
}

export interface DefaultPieceTemplate {
	pieceType: string
	name?: string
	payload?: Record<string, PayloadValue>
	/** When true, piece is not auto-created — user can add via piece buttons */
	optional?: boolean
}

export interface DefaultPartTemplate {
	partType: string
	name?: string
	duration?: number
	script?: string
	/** Override the part type manifest defaultPieces for this instance */
	defaultPieces?: DefaultPieceTemplate[]
}

export interface TypeManifest {
	id: string
	entityType: TypeManifestEntity
	name: string
	shortName: string
	colour: string
	includeTypeInName?: boolean
	/** HTML template folder name for GFX preview iframe (e.g. l3d-tema) */
	previewTemplate?: string
	/** Label shown on creation toolbar buttons */
	buttonLabel?: string
	/** Editorial type string sent to Sofie ingest (part types) */
	ingestType?: string
	/** Show this type on segment/part creation toolbars */
	showInToolbar?: boolean
	/** Part types: pieces created automatically when adding this part type */
	defaultPieces?: DefaultPieceTemplate[]
	/** Segment types: parts created automatically when adding this segment type */
	defaultParts?: DefaultPartTemplate[]

	payload: PayloadManifest[]
}
export interface DBTypeManifest {
	id: string
	entityType: TypeManifestEntity
	document: string
}

export interface PayloadManifest {
	id: string
	label: string
	type: ManifestFieldType
	includeInName?: boolean
	/** Subfolder under the ingest/media root for mediaPick fields (default: clips) */
	subdir?: string
	/** Fixed choices for string fields (rendered as radio buttons when set) */
	options?: string[]
	/** Helper text shown below option radio buttons */
	optionsHelperText?: string
	/**
	 * When true, this field appears in the Daily rewrite view for bulk day-of editing.
	 * Set in megarepo piece-type manifests (`sofie-rundown-editor-piece-types.json`).
	 */
	dailyEditable?: boolean
}

/** Core/Package Manager confirmation for a scanned media file (not local fs existence). */
export type MediaFileReadiness = 'confirmed' | 'not-confirmed' | 'unknown'

export interface MediaFileEntry {
	name: string
	path: string
	size?: number
	mtime?: number
	/** Clip duration in seconds when ffprobe succeeds. */
	durationSeconds?: number
	/**
	 * Package Manager confirmation for this file on the active rundown.
	 * `'unknown'` when Core has not evaluated this exact path yet — never inferred from local fs.
	 */
	readiness?: MediaFileReadiness
	/** Operator-facing reason when readiness is `not-confirmed` (or optional note for `unknown`). */
	reason?: string
}

/** Which path produced a ready/not-ready verdict for a media requirement. */
export type ReadinessStatusSource = 'core' | 'fs'

/** Single media field readiness (MOS-style clip status). */
export interface MediaRequirement {
	fieldId: string
	path: string
	ready: boolean
	reason?: string
	/** Path that produced this verdict (Package Manager via Core, or local filesystem). */
	source?: ReadinessStatusSource
}

export interface PieceReadiness {
	pieceId: string
	partId: string
	ready: boolean
	requirements: MediaRequirement[]
	/**
	 * Aggregate provenance for this piece's media verdict.
	 * `'core'` when Package Manager status was used for any assigned media path;
	 * `'fs'` when evaluation fell back to local filesystem (or local-only checks).
	 */
	source?: ReadinessStatusSource
}

export interface RundownReadinessDiagnostics {
	coreConnectionStatus: CoreConnectionStatus
	coreCallSource: 'core' | 'core-disconnected' | 'core-error'
	/** Safe operator-facing label only (never raw Core exception text). */
	coreCallError?: string
	/** Piece statuses returned by Core; 0 is ambiguous — do not over-interpret. */
	corePieceStatusCount: number
	piecesFromCore: number
	piecesFromFsFallback: number
	checkedAt: string
}

export interface RundownReadiness {
	pieces: Record<string, PieceReadiness>
	parts: Record<
		string,
		{
			ready: boolean
			mediaPieceCount: number
			readyMediaPieceCount: number
		}
	>
	summary: {
		totalMediaPieces: number
		readyMediaPieces: number
	}
	diagnostics?: RundownReadinessDiagnostics
}

/** How ILU story duration is sent to Sofie (auto-take after time vs wait for take). */
export type IluDurationMode = 'auto' | 'manual'

export interface ApplicationSettings {
	coreUrl?: string
	corePort?: number
	/** Overrides INGEST_MEDIA_ROOT env when set (absolute or relative path). */
	ingestMediaRoot?: string
	/** Overrides PREVIEW_BASE_URL env when set. */
	previewBaseUrl?: string
	/**
	 * Template rundown id used for the daily scheduled clone.
	 * Must reference an existing rundown with `isTemplate === true`.
	 * Feature is inert when unset.
	 */
	dailyTemplateRundownId?: string
	/**
	 * Wall-clock time (`HH:mm`) in `dailyCloneTimezone` after which today's clone may run.
	 * Feature is inert when unset — no default clone time is invented.
	 */
	dailyCloneTime?: string
	/**
	 * IANA timezone for daily clone date/time (default `Europe/Bratislava`).
	 */
	dailyCloneTimezone?: string
	/**
	 * Default characters-per-second for script reading-time estimates.
	 * Users can override with a personal CPS on their account (null = use this default).
	 */
	scriptCps?: number
	/**
	 * When `auto`, ILU parts export `autoNext: true` so Sofie can take after the reading time.
	 * When `manual`, duration is still sent but auto-take is not requested.
	 */
	iluDurationMode?: IluDurationMode
	/**
	 * When true, skipped parts/pieces show a Skipped status unless `editorChecked` is set.
	 * When false, skip never invents a status badge from skip alone.
	 */
	skipStatusUnlessEditorChecked?: boolean
	/**
	 * When true, parts that are not `editorChecked` are treated as not ready for air
	 * (shown alongside media NR, and `editorChecked` is exported for blueprints).
	 */
	requireEditorCheckForAir?: boolean
}

export type DailyGenerationStatus = 'in_progress' | 'completed' | 'failed'

export interface DailyGenerationRow {
	sourceTemplateId: string
	generatedDate: string
	generatingTimezone: string
	attemptId: string
	idempotencyKey: string
	leaseExpiresAt: string
	rundownId: string | null
	status: DailyGenerationStatus
}

export interface DailyGenerationStatusResult {
	generatedDate: string
	timezone: string
	status: DailyGenerationStatus | null
	rundownId: string | null
	rundownName?: string
}

export interface DailyGenerationResult {
	generatedDate: string
	timezone: string
	status: DailyGenerationStatus
	rundownId: string | null
	rundown?: Rundown
	attemptId: string
	idempotencyKey: string
	created: boolean
}
export interface DBSettings {
	id: string
	document: string
}

export enum IpcOperationType {
	Create = 'create',
	Copy = 'copy',
	Read = 'read',
	Update = 'update',
	Reorder = 'reorder',
	Delete = 'delete',
	CloneSet = 'cloneSet',
	Move = 'move'
}

export interface MutationCopy {
	preserveName?: boolean
	preserveTemplate?: boolean
}

export interface IpcOperation {
	type: IpcOperationType
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload: any
}

export type MutationPieceCreate = SetOptional<Piece, 'id'>

export type MutationPieceCopy = SetOptional<Pick<Piece, 'id' | 'partId'>, 'partId'> & MutationCopy

export type MutationPieceRead = Pick<Piece, 'id' | 'rundownId' | 'segmentId' | 'partId'>

export type MutationPieceUpdate = Piece

export type MutationPieceDelete = Pick<Piece, 'id'>

export type MutationPieceCloneFromParToPart = {
	fromPartId: string
	toPartId: string
}

export interface MutatedRundown {
	externalId: string
	name: string
	type: 'sofie-rundown-editor'
	segments: MutatedSegment[]
	payload: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any
		name: string
		expectedStart: number | undefined
		expectedEnd: number | undefined
	}
}

export interface MutatedSegment {
	externalId: string
	name: string
	rank: number
	payload: { name: string; rank: number; type: string }
	parts: MutatedPart[]
}

export interface MutatedPart {
	externalId: string
	name: string
	rank: number
	payload: {
		segmentId: string
		externalId: string
		rank: number
		name: string
		type: string | undefined
		float: boolean
		skip?: boolean
		editorChecked?: boolean
		/** When true, Sofie may auto-take after `duration` (ILU auto mode). */
		autoNext?: boolean
		script: string | undefined
		duration: number | undefined
		pieces: MutatedPiece[]
	}
}

export interface MutatedPiece {
	id: string
	name: string
	objectType: string
	objectTime: number | undefined
	duration: number | undefined
	clipName: string | undefined
	attributes: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[key: string]: any
		adlib: boolean
	}
	position: number | undefined
}

export type MutationPartCreate = SetOptional<Part, 'id' | 'rank'> & {
	/** Override defaultPieces from the part type manifest for this create only */
	presetPieces?: DefaultPieceTemplate[]
}

export type MutationPartCopy = SetOptional<
	Pick<Part, 'id' | 'rundownId' | 'segmentId'>,
	'segmentId'
> &
	MutationCopy

export type MutationPartCopyResult = { part: Part; pieces: Piece[] }

export type MutationPartCloneFromSegmentToSegment = {
	fromSegmentId: string
	toSegmentId: string
}

export type MutationPartMove = {
	sourcePart: Part
	targetPart: Part
	targetIndex: number
}

export type MutationPartRead = Pick<Part, 'id' | 'rundownId' | 'segmentId' | 'rank'>

export type MutationPartUpdate = Part

export type MutationPartDelete = Pick<Part, 'id'>

export type MutationTypeManifestCreate = Pick<TypeManifest, 'id' | 'entityType'> &
	Partial<TypeManifest>

export type MutationTypeManifestRead = Pick<DBTypeManifest, 'id' | 'entityType'>

export type MutationTypeManifestUpdate = Pick<TypeManifest, 'id' | 'entityType'> & {
	update: Pick<TypeManifest, 'name' | 'shortName' | 'colour' | 'includeTypeInName' | 'id'> &
		Partial<TypeManifest>
}

export type MutationTypeManifestDelete = Pick<TypeManifest, 'id' | 'entityType'>

export type MutationRundownCreate = SetOptional<Rundown, 'id'>

export type MutationSegmentCopy = Pick<SetOptional<Segment, 'rank'>, 'id' | 'rundownId' | 'rank'> &
	MutationCopy

export type MutationSegmentCopyResult = { segment: Segment; parts: Part[]; pieces: Piece[] }

export type MutationSegmentCloneFromRundownToRundown = {
	fromRundownId: string
	toRundownId: string
	insertRank?: number
}

export type MutationRundownRead = Pick<Rundown, 'id'>

export type MutationRundownCopy = Pick<Rundown, 'id'> &
	MutationCopy & {
		/** Stamped on the cloned rundown for daily-generation reconcile. */
		attemptId?: string
		idempotencyKey?: string
	}

export type MutationRundownCopyResult = {
	rundown: Rundown
	segments: Segment[]
	parts: Part[]
	pieces: Piece[]
}

export type MutationRundownUpdate = Rundown

export type MutationRundownDelete = Pick<Rundown, 'id'>

export type MutationSegmentsRead = { rundownId: string } | { isTemplate: boolean }

export type MutationSegmentCreate = SetOptional<Segment, 'id' | 'rank' | 'isTemplate'> & {
	/** When true, create default parts/pieces from the segment type manifest */
	materializePreset?: boolean
}

export type MutationSegmentRead = Pick<Segment, 'id' | 'rundownId'>

export type MutationSegmentUpdate = Segment

export type MutationSegmentDelete = Pick<Segment, 'id'>

export type MutationApplicationSettingsCreate = ApplicationSettings

export type MutationApplicationSettingsUpdate = ApplicationSettings

export enum CoreConnectionStatus {
	CONNECTED = 'Connected',
	DISCONNECTED = 'Disconnected'
}

export interface CoreConnectionInfo {
	status: CoreConnectionStatus
	url?: string
	port?: number
}

export interface SerializedRundown {
	rundown: Rundown
	segments: Segment[]
	parts: Part[]
	pieces: Piece[]
	isTemplate?: boolean
}

export interface OpenFromFileArgs {
	title: string
}
export interface SaveToFileArgs {
	title: string
	document: unknown
}

export interface MutationReorder<T> {
	element: T
	sourceIndex: number
	targetIndex: number
}
export interface PiecesUpdateEvent {
	pieces?: Piece[]
}
export interface PartsUpdateEvent {
	parts?: Part[]
}
export interface SegmentsUpdateEvent {
	segments?: Segment[]
}
