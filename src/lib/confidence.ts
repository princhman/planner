export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export const confidenceLabels = [
    "Not started",
    "Recognise it",
    "Can explain it",
    "Can do some questions",
    "Exam ready!",
];

export const confidenceBgColors = [
    "bg-gray-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
];

export const confidenceTextColors = [
    "text-gray-400",
    "text-red-400",
    "text-orange-400",
    "text-yellow-400",
    "text-green-400",
];

export function toConfidenceLevel(
    confidence: unknown,
    fallback: ConfidenceLevel = 1,
): ConfidenceLevel {
    const value =
        typeof confidence === "string" ? Number(confidence) : confidence;

    if (
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= 5
    ) {
        return value as ConfidenceLevel;
    }

    return fallback;
}
