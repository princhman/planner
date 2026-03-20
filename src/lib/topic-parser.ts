/**
 * Parses a plain-text outline into a list of topic entries.
 *
 * Accepted formats:
 *   1. Photosynthesis
 *   2.3 Mitosis
 *   5.3.1 Redox reactions
 *   1 Intro (no dot)
 *   - Unrecognised lines are returned as errors
 *
 * Rules:
 *   - Code is the leading number (e.g. "1", "2.3", "5.3.1")
 *   - Depth is the number of segments in the code
 *   - Parent code is derived by removing the last segment
 *   - Duplicate codes within one import are rejected
 */

export type ParsedTopic = {
	code: string;
	title: string;
	depth: number;
	parentCode: string | null;
};

export type ParseError = {
	line: number;
	text: string;
	reason: string;
};

export type ParseResult = {
	topics: ParsedTopic[];
	errors: ParseError[];
};

// Match lines like "1.", "2.3", "5.3.1", optionally followed by a title
// Supports optional trailing dot on the code (e.g. "1." or "2.3.")
const LINE_PATTERN = /^\s*(\d+(?:\.\d+)*)\.?\s+(.+)$/;

export function parseTopicOutline(text: string): ParseResult {
	const lines = text.split("\n");
	const topics: ParsedTopic[] = [];
	const errors: ParseError[] = [];
	const seenCodes = new Set<string>();

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i];
		const trimmed = raw.trim();

		// Skip empty lines
		if (!trimmed) continue;

		const match = trimmed.match(LINE_PATTERN);
		if (!match) {
			errors.push({
				line: i + 1,
				text: trimmed,
				reason: "Could not parse a topic code. Expected format: \"1.2.3 Topic title\"",
			});
			continue;
		}

		const code = match[1];
		const title = match[2].trim();

		if (!title) {
			errors.push({
				line: i + 1,
				text: trimmed,
				reason: "Topic title is empty.",
			});
			continue;
		}

		if (seenCodes.has(code)) {
			errors.push({
				line: i + 1,
				text: trimmed,
				reason: `Duplicate topic code "${code}".`,
			});
			continue;
		}

		seenCodes.add(code);

		const segments = code.split(".");
		const depth = segments.length;
		const parentCode =
			depth > 1 ? segments.slice(0, -1).join(".") : null;

		topics.push({ code, title, depth, parentCode });
	}

	return { topics, errors };
}
