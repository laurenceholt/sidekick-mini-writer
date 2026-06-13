import type { MiniEvalReport } from "./types";

export function formatMiniEvalReport(report: MiniEvalReport) {
  const dimensions = report.dimensions
    .map((dimension) => `- **${dimension.label}:** ${dimension.rating}. ${dimension.evidence}`)
    .join("\n");
  const suggestions = report.suggestions
    .map((suggestion) => {
      const steps = suggestion.steps.length ? ` (${suggestion.steps.join(", ")})` : "";
      return `${suggestion.number}. **[${suggestion.priority}] ${suggestion.title}${steps}**\n   - Issue: ${suggestion.issue}\n   - Suggestion: ${suggestion.suggestion}`;
    })
    .join("\n\n");

  return `**Eval mini**\n\n**Overall:** ${report.overallRating}\n\n**Ready for review:** ${report.readyForReview ? "Yes" : "No"}\n\n${report.summary}\n\n**Dimensions**\n${dimensions}\n\n**Suggestions**\n${suggestions || "No specific suggestions."}`;
}
