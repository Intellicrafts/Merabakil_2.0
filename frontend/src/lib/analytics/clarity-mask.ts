/**
 * Spread onto any element whose subtree must never be uploaded to Microsoft Clarity.
 *
 * Clarity records the DOM. Its default "Balanced" masking mode only masks numbers and
 * email addresses — free text is uploaded verbatim. In a legal platform that means AI
 * chat about a user's legal problem, uploaded document bodies, case briefs naming
 * opposing parties, consultation messages and admin user tables would all leave the
 * browser unless we mask them explicitly.
 *
 * `data-clarity-mask` masks the node and every descendant, and overrides any masking
 * rule configured in the Clarity dashboard. Masked content is never sent over the wire.
 *
 * Rule of thumb: if an element renders content a user typed, uploaded, or that names a
 * real person, it gets CLARITY_MASK. Chrome, navigation, buttons and marketing copy
 * stay unmasked — those are what the heatmaps are for.
 *
 * @example
 * <div {...CLARITY_MASK} className="chat-bubble">{message.content}</div>
 */
export const CLARITY_MASK = { "data-clarity-mask": "true" } as const;
