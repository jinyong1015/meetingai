/** Strict JSON Schemas for OpenAI Structured Outputs. */

export const SUMMARY_JSON_SCHEMA = {
  type: "object",
  properties: {
    summaryText: { type: "string" },
  },
  required: ["summaryText"],
  additionalProperties: false,
} as const;

export const DETAIL_JSON_SCHEMA = {
  type: "object",
  properties: {
    documentTitle: { type: "string" },
    meetingTitle: { type: "string" },
    datetime: { type: "string" },
    location: { type: "string" },
    attendees: {
      type: "array",
      items: { type: "string" },
    },
    host: { type: "string" },
    purpose: { type: "string" },
    agendas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          discussions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                speaker: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
                content: { type: "string" },
              },
              required: ["speaker", "content"],
              additionalProperties: false,
            },
          },
          decisions: {
            type: "array",
            items: { type: "string" },
          },
          actionItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                task: { type: "string" },
                owner: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
                due: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
              },
              required: ["task", "owner", "due"],
              additionalProperties: false,
            },
          },
        },
        required: ["title", "discussions", "decisions", "actionItems"],
        additionalProperties: false,
      },
    },
    nextMeeting: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    additionalItems: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "documentTitle",
    "meetingTitle",
    "datetime",
    "location",
    "attendees",
    "host",
    "purpose",
    "agendas",
    "nextMeeting",
    "additionalItems",
  ],
  additionalProperties: false,
} as const;
