import type { CourtroomSimulationAdapter } from "@/lib/courtroom/adapter";
import { hashIntakeSeed } from "@/lib/courtroom/case-bundle";
import { toHindiCompanion } from "@/lib/courtroom/bilingual";
import { getDemoPreset } from "@/lib/courtroom/demo-sessions";
import type {
  CourtroomEvent,
  CourtroomListener,
  CourtroomSessionConfig,
  CourtroomState,
  HearingMetrics,
  JudgmentReport,
  ObjectionType,
  SpeakerRole,
  TranscriptEntry,
} from "@/lib/courtroom/types";

interface ScriptBeat {
  delayMs: number;
  role: SpeakerRole;
  speaker: string;
  text: string;
  textHi?: string;
  judgeState?: CourtroomState["judgeState"];
  judgeNote?: string;
  timeline?: CourtroomState["timelineStep"];
  metrics?: Partial<HearingMetrics>;
  thinkMs?: number;
}

function hi(text: string, custom?: string): string {
  return custom ?? toHindiCompanion(text);
}

function initialState(): CourtroomState {
  return {
    phase: "setup",
    activeSpeaker: null,
    judgeState: "listening",
    timelineStep: "opening",
    transcript: [],
    exhibits: [],
    authorities: [],
    objections: [],
    metrics: {
      argumentStrength: 0.45,
      evidenceSupport: 0.4,
      proceduralCompliance: 0.85,
    },
    elapsedSeconds: 0,
    isPaused: false,
    judgment: null,
    isThinking: false,
  };
}

function variantIndex(config: CourtroomSessionConfig): number {
  const seed = config.intake
    ? hashIntakeSeed(config.intake, config.matterType)
    : config.presetId?.length ?? 0;
  return seed % 3;
}

function buildScript(config: CourtroomSessionConfig): ScriptBeat[] {
  const p = config.petitionerName;
  const r = config.respondentName;
  const isWrit = config.presetId === "article-21-writ";
  const variant = variantIndex(config);
  const intakeNote = config.intake?.summary
    ? ` Record reflects intake: ${config.intake.summary.slice(0, 80)}…`
    : "";

  if (isWrit) {
    const openings = [
      "This is an AI simulation. We are seized of a writ petition under Article 226. Petitioner may open.",
      "Simulated bench notes constitutional urgency. Petitioner, you may commence on liberty grounds.",
      "Writ jurisdiction invoked. This hearing models Article 21 scrutiny — petitioner may lead.",
    ];
    return [
      {
        delayMs: 0,
        role: "clerk",
        speaker: "Court Clerk",
        text: `Matter listed. All parties present. Hon'ble AI Judge presiding.${intakeNote}`,
        textHi: hi(`Matter listed. All parties present. Hon'ble AI Judge presiding.${intakeNote}`, "मामला सूचीबद्ध। सभी पक्ष उपस्थित। माननीय AI न्यायाधीश की अध्यक्षता में।"),
      },
      {
        delayMs: 2200,
        role: "judge",
        speaker: "Hon'ble AI Judge",
        text: openings[variant],
        textHi: hi(openings[variant], "यह AI सिमुलेशन है। धारा 226 के अंतर्गत रिट याचिका सुनवाई में है। याचिकाकर्ता प्रारंभ कर सकते हैं।"),
        judgeState: "listening",
        judgeNote: "Opening the hearing",
        thinkMs: 500,
      },
      {
        delayMs: 2800,
        role: "petitioner",
        speaker: p,
        text: "My Lords, the impugned detention order lacks reasons and violates Article 21. The medical report shows the petitioner was not medically fit for custody.",
        textHi: "माननीय न्यायालय, प्रश्नगत हिरासत आदेश में कारणों का अभाव है और यह धारा 21 का उल्लंघन करता है। चिकित्सा रिपोर्ट से स्पष्ट है कि याचिकाकर्ता हिरासत के लिए चिकित्सीय रूप से उपयुक्त नहीं था।",
        metrics: { argumentStrength: 0.58 + variant * 0.02 },
        thinkMs: 600,
      },
      {
        delayMs: 3200,
        role: "judge",
        speaker: "Hon'ble AI Judge",
        text: "Was the detention order communicated with grounds as required?",
        textHi: "क्या हिरासत आदेश आवश्यक आधारों सहित सूचित किया गया था?",
        judgeState: "questioning",
        judgeNote: "Testing procedural compliance",
      },
      {
        delayMs: 2600,
        role: "respondent",
        speaker: r,
        text: "The order was served under the applicable preventive detention framework. Grounds were supplied within statutory timelines.",
        textHi: "आदेश लागू निवारक हिरासत ढांचे के अंतर्गत जारी किया गया। आधार वैधानिक समयसीमा में प्रदान किए गए।",
        metrics: { argumentStrength: 0.52 },
      },
      {
        delayMs: 2400,
        role: "petitioner",
        speaker: p,
        text: "Exhibit P-2 contradicts that position — the medical examination was ignored.",
        textHi: "प्रदर्श संख्या P-2 इस स्थिति का खंडन करता है — चिकित्सा परीक्षण को अनदेखा किया गया।",
        timeline: "examination",
      },
      {
        delayMs: 3000,
        role: "judge",
        speaker: "Hon'ble AI Judge",
        text: "Mark the medical report. Respondent, address Maneka Gandhi on due process.",
        textHi: "चिकित्सा रिपोर्ट अंकित करें। प्रतिवादी, उचित प्रक्रिया पर मानेका गांधी का उत्तर दें।",
        judgeState: "questioning",
      },
      {
        delayMs: 2800,
        role: "respondent",
        speaker: r,
        text: "The procedure followed was fair. The advisory board considered the material.",
        textHi: "अपनाई गई प्रक्रिया न्यायसंगत थी। सलाहकार बोर्ड ने सामग्री पर विचार किया।",
        metrics: { evidenceSupport: 0.48 + variant * 0.03 },
      },
      {
        delayMs: 2000,
        role: "petitioner",
        speaker: p,
        text: "Objection — the board record is not before this simulated bench.",
        textHi: "आपत्ति — बोर्ड का रिकॉर्ड इस सिमुलेटेड बेंच के समक्ष नहीं है।",
        timeline: "objections",
      },
      {
        delayMs: 2200,
        role: "judge",
        speaker: "Hon'ble AI Judge",
        text: "Sustained. Respondent shall rely only on exhibits on record.",
        textHi: "आपत्ति स्वीकार। प्रतिवादी केवल रिकॉर्ड पर प्रदर्शों पर निर्भर रहेगा।",
        judgeState: "ruling",
        judgeNote: "Objection sustained",
      },
      {
        delayMs: 2800,
        role: "petitioner",
        speaker: p,
        text: "In closing, liberty is not a gift of procedure — it is constitutional. We pray for quashing.",
        textHi: "समापन में, स्वतंत्रता प्रक्रिया का उपहार नहीं — यह संवैधानिक है। हम रद्दीकरण की प्रार्थना करते हैं।",
        timeline: "closing",
        metrics: { argumentStrength: 0.72, evidenceSupport: 0.65 },
      },
      {
        delayMs: 2400,
        role: "respondent",
        speaker: r,
        text: "The State acted within law. No case for interference in this simulation.",
        textHi: "राज्य ने कानून के अंतर्गत कार्य किया। इस सिमुलेशन में हस्तक्षेप का कोई आधार नहीं।",
        metrics: { argumentStrength: 0.55 },
      },
      {
        delayMs: 2000,
        role: "judge",
        speaker: "Hon'ble AI Judge",
        text: "Arguments concluded. Court will deliberate.",
        textHi: "तर्क समाप्त। न्यायालय विचार करेगा।",
        judgeState: "deliberating",
        timeline: "deliberation",
      },
    ];
  }

  const commercialOpenings = [
    "Parties are heard on breach of the Master Service Agreement. Petitioner may lead.",
    "Commercial bench convened on SLA breach. Petitioner, open on liability and relief.",
    "This simulation addresses contractual performance. Petitioner may commence.",
  ];

  return [
    {
      delayMs: 0,
      role: "clerk",
      speaker: "Court Clerk",
      text: `Matter called. AI Courtroom Simulation — not a real court proceeding.${intakeNote}`,
      textHi: hi(`Matter called. AI Courtroom Simulation — not a real court proceeding.${intakeNote}`, "मामला बुलाया गया। AI कोर्टरूम सिमुलेशन — वास्तविक न्यायालय कार्यवाही नहीं।"),
    },
    {
      delayMs: 2200,
      role: "judge",
      speaker: "Hon'ble AI Judge",
      text: commercialOpenings[variant],
      textHi: hi(commercialOpenings[variant], "पक्षों को मास्टर सेवा समझौते के उल्लंघन पर सुना जाएगा। याचिकाकर्ता प्रारंभ कर सकते हैं।"),
      judgeState: "listening",
      judgeNote: "Commencing commercial hearing",
      thinkMs: 500,
    },
    {
      delayMs: 3000,
      role: "petitioner",
      speaker: p,
      text: "My Lords, respondent failed SLA thresholds for three consecutive quarters. Notice was served; breach continued.",
      textHi: "माननीय न्यायालय, प्रतिवादी ने लगातार तीन तिमाहियों में SLA सीमा पार की। नोटिस जारी की गई; उल्लंघन जारी रहा।",
      metrics: { argumentStrength: 0.6 + variant * 0.02, evidenceSupport: 0.55 },
      thinkMs: 650,
    },
    {
      delayMs: 2800,
      role: "judge",
      speaker: "Hon'ble AI Judge",
      text: "What relief is sought — damages, specific performance, or both?",
      textHi: "क्या राहत मांगी गई — हर्जाना, विशिष्ट निष्पादन, या दोनों?",
      judgeState: "questioning",
    },
    {
      delayMs: 2600,
      role: "petitioner",
      speaker: p,
      text: "Both. Section 73 damages and specific performance under the Specific Relief Act.",
      textHi: "दोनों। धारा 73 के अंतर्गत हर्जाना और विशिष्ट राहत अधिनियम के तहत विशिष्ट निष्पादन।",
      timeline: "examination",
    },
    {
      delayMs: 3000,
      role: "respondent",
      speaker: r,
      text: "Force majeure and amended delivery protocols excuse performance. Logs in Exhibit R-3 show compliance.",
      textHi: "अप्रत्याशित घटना और संशोधित वितरण प्रोटोकॉल प्रदर्शन को सही ठहराते हैं। प्रदर्श R-3 के लॉग अनुपालन दर्शाते हैं।",
      metrics: { argumentStrength: 0.5, evidenceSupport: 0.5 + variant * 0.02 },
    },
    {
      delayMs: 2400,
      role: "judge",
      speaker: "Hon'ble AI Judge",
      text: "Mark Exhibit R-3 for identification. Petitioner?",
      textHi: "प्रदर्श R-3 को पहचान के लिए अंकित करें। याचिकाकर्ता?",
      judgeState: "listening",
    },
    {
      delayMs: 2800,
      role: "petitioner",
      speaker: p,
      text: "The logs are self-serving and inconsistent with the breach notice.",
      textHi: "लॉग स्व-हितपरक हैं और उल्लंघन नोटिस के साथ असंगत हैं।",
      metrics: { argumentStrength: 0.65 },
    },
    {
      delayMs: 2200,
      role: "respondent",
      speaker: r,
      text: "Objection — hearsay regarding third-party carrier statements.",
      textHi: "आपत्ति — तृतीय-पक्ष वाहक कथनों के संबंध में सुनवाई योग्य नहीं।",
      timeline: "objections",
    },
    {
      delayMs: 2400,
      role: "judge",
      speaker: "Hon'ble AI Judge",
      text: "Overruled for simulation purposes; weight to be assessed in deliberation.",
      textHi: "सिमुलेशन हेतु आपत्ति खारिज; विचाराधीन में महत्व का मूल्यांकन होगा।",
      judgeState: "ruling",
      judgeNote: "Objection overruled",
    },
    {
      delayMs: 2800,
      role: "petitioner",
      speaker: p,
      text: "Section 73 compensation is quantifiable from lost production schedules.",
      textHi: "धारा 73 के अंतर्गत क्षतिपूर्ति खोई उत्पादन अनुसूचियों से मापी जा सकती है।",
      timeline: "closing",
      metrics: { evidenceSupport: 0.7, proceduralCompliance: 0.9 },
    },
    {
      delayMs: 2600,
      role: "respondent",
      speaker: r,
      text: "No concluded breach; contract permits cure period. Petition fails.",
      textHi: "कोई निर्णीत उल्लंघन नहीं; अनुबंध सुधार अवधि की अनुमति देता है। याचिका असफल।",
      metrics: { argumentStrength: 0.48 },
    },
    {
      delayMs: 2000,
      role: "judge",
      speaker: "Hon'ble AI Judge",
      text: "Hearing closed. Court retires to deliberate.",
      textHi: "सुनवाई समाप्त। न्यायालय विचार हेतु विराम करता है।",
      judgeState: "deliberating",
      timeline: "deliberation",
    },
  ];
}

function buildJudgment(config: CourtroomSessionConfig, metrics: HearingMetrics): JudgmentReport {
  const isWrit = config.presetId === "article-21-writ";
  const preset = config.presetId ? getDemoPreset(config.presetId) : undefined;
  const authorities = preset?.authorities ?? [];
  const agentSummaries = config.agents?.map(
    (a) => `${a.displayName}: ${a.strategy.slice(0, 2).join("; ")}`,
  );

  if (isWrit) {
    return {
      matterTitle: config.matterTitle,
      findingsOfFact: [
        "The detention order was issued and served within the simulated record.",
        "Medical evidence on record raises a prima facie concern regarding fitness for custody.",
        "Procedural compliance on supply of grounds is disputed; respondent bears burden to demonstrate compliance.",
      ],
      findingsOfFactHi: [
        "सिमुलेटेड रिकॉर्ड के अनुसार हिरासत आदेश जारी और सूचित किया गया।",
        "रिकॉर्ड पर चिकित्सा साक्ष्य हिरासत की उपयुक्तता पर प्राथमिक चिंता उत्पन्न करता है।",
        "आधारों की आपूर्ति पर प्रक्रियात्मक अनुपालन विवादित है; प्रतिवादी पर अनुपालन सिद्ध करने का बोझ।",
      ],
      legalReasoning:
        "Applying Article 21 and Maneka Gandhi, procedure must be fair, just, and reasonable. In this simulation, the petitioner's medical exhibit creates a triable issue warranting further scrutiny.",
      legalReasoningHi:
        "धारा 21 और मानेका गांधी लागू करते हुए, प्रक्रिया न्यायसंगत, निष्पक्ष और उचित होनी चाहिए। इस सिमुलेशन में याचिकाकर्ता का चिकित्सा प्रदर्श विचारणीय मुद्दा उत्पन्न करता है।",
      confidence: metrics,
      authorities,
      nextSteps: [
        "Direct production of advisory board minutes within simulated discovery.",
        "List for physical production of original detention file.",
        "Consider interim medical examination order.",
      ],
      nextStepsHi: [
        "सिमुलेटेड खोज के अंतर्गत सलाहकार बोर्ड की कार्यवाही का उत्पादन निर्देशित करें।",
        "मूल हिरासत फाइल के भौतिक उत्पादन के लिए सूचीबद्ध करें।",
        "अंतरिम चिकित्सा परीक्षा आदेश पर विचार करें।",
      ],
      disposition: "Simulated — matter remanded for compliance verification",
      dispositionHi: "सिमुलेटेड — अनुपालन सत्यापन हेतु मामला वापस",
      generatedAt: new Date().toISOString(),
      intakeSummary: config.intake?.summary,
      agentSummaries,
      timelineSteps: ["opening", "examination", "objections", "closing", "deliberation"],
    };
  }

  return {
    matterTitle: config.matterTitle,
    findingsOfFact: [
      "A Master Service Agreement governed the parties' relationship.",
      "SLA metrics for Q3 2025 fell below contracted thresholds per petitioner's notice.",
      "Respondent's delivery logs show partial compliance but not cure of prior defaults.",
    ],
    findingsOfFactHi: [
      "मास्टर सेवा समझौता पक्षों के संबंधों को नियंत्रित करता था।",
      "Q3 2025 के SLA मेट्रिक्स याचिकाकर्ता की नोटिस के अनुसार अनुबंधित सीमा से नीचे गए।",
      "प्रतिवादी के वितरण लॉग आंशिक अनुपालन दर्शाते हैं परंतु पूर्व चूकों का सुधार नहीं।",
    ],
    legalReasoning:
      "Under Section 73 of the Indian Contract Act, compensation follows breach where loss is foreseeable. This simulation finds a material breach on the record, with quantifiable loss subject to proof.",
    legalReasoningHi:
      "भारतीय अनुबंध अधिनियम की धारा 73 के अंतर्गत, पूर्वानुमेय हानि पर उल्लंघन के बाद क्षतिपूर्ति होती है। इस सिमुलेशन में रिकॉर्ड पर भौतिक उल्लंघन पाया गया।",
    confidence: metrics,
    authorities,
    nextSteps: [
      "Appoint court commissioner for log verification (simulated recommendation).",
      "Frame issues on force majeure and cure period.",
      "Explore mediated settlement before final decree.",
    ],
    nextStepsHi: [
      "लॉग सत्यापन हेतु कोर्ट कमिश्नर नियुक्त करें (सिमुलेटेड सिफारिश)।",
      "अप्रत्याशित घटना और सुधार अवधि पर मुद्दे निर्धारित करें।",
      "अंतिम डिक्री से पूर्व मध्यस्थता से समझौते का प्रयास करें।",
    ],
    disposition: "Simulated — partial relief: damages pathway open; specific performance on narrow terms",
    dispositionHi: "सिमुलेटेड — आंशिक राहत: हर्जाना मार्ग खुला; संकीर्ण शर्तों पर विशिष्ट निष्पादन",
    generatedAt: new Date().toISOString(),
    intakeSummary: config.intake?.summary,
    agentSummaries,
    timelineSteps: ["opening", "examination", "objections", "closing", "deliberation"],
  };
}

export function createMockCourtroomAdapter(): CourtroomSimulationAdapter {
  let state = initialState();
  const listeners = new Set<CourtroomListener>();
  let config: CourtroomSessionConfig | null = null;
  let script: ScriptBeat[] = [];
  let scriptIndex = 0;
  let scriptTimer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let objectionPending = false;
  let speechGated = false;
  let awaitingSpeech = false;
  let pendingBeat: ScriptBeat | null = null;

  const emit = (event: CourtroomEvent) => {
    listeners.forEach((l) => l(event));
  };

  const updateMetrics = (partial: Partial<HearingMetrics>) => {
    state = {
      ...state,
      metrics: { ...state.metrics, ...partial },
    };
    emit({ type: "metricsUpdate", metrics: state.metrics });
  };

  const addTranscript = (beat: ScriptBeat) => {
    const entry: TranscriptEntry = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      speaker: beat.speaker,
      role: beat.role,
      text: beat.text,
      textHi: beat.textHi,
      timestamp: state.elapsedSeconds,
    };
    state = { ...state, transcript: [...state.transcript, entry] };
    emit({ type: "transcript", entry });
  };

  const runBeat = (beat: ScriptBeat) => {
    if (beat.timeline) {
      state = { ...state, timelineStep: beat.timeline };
      emit({ type: "timelineStep", step: beat.timeline });
    }
    if (beat.judgeState) {
      state = { ...state, judgeState: beat.judgeState, judgeNote: beat.judgeNote };
      emit({ type: "judgeState", state: beat.judgeState, note: beat.judgeNote });
    }
    if (beat.metrics) updateMetrics(beat.metrics);
    state = { ...state, activeSpeaker: beat.role, isThinking: false };
    emit({ type: "thinking", active: false });
    emit({ type: "speakerChange", role: beat.role });
    addTranscript(beat);
    if (beat.role !== "judge" && beat.role !== "clerk") {
      setTimeout(() => {
        if (state.phase === "hearing" && !state.isPaused) {
          state = { ...state, activeSpeaker: null };
          emit({ type: "speakerChange", role: null });
        }
      }, 1200);
    }
  };

  const finishHearing = () => {
    if (scriptTimer) clearTimeout(scriptTimer);
    scriptTimer = null;
    awaitingSpeech = false;
    pendingBeat = null;
    state = {
      ...state,
      phase: "deliberation",
      activeSpeaker: null,
      judgeState: "deliberating",
      isThinking: false,
    };
    emit({ type: "thinking", active: false });
    emit({ type: "phaseChange", phase: "deliberation" });
    emit({ type: "speakerChange", role: null });
    emit({ type: "judgeState", state: "deliberating", note: "Reviewing exhibits and authorities" });

    setTimeout(() => {
      if (!config || state.phase !== "deliberation") return;
      const report = buildJudgment(config, state.metrics);
      state = {
        ...state,
        judgment: report,
        judgeState: "deliberating",
        judgeNote: "Judgment prepared — awaiting bench delivery",
      };
      emit({ type: "judgmentReady", report });
    }, 3500);
  };

  const playBeat = (beat: ScriptBeat) => {
    if (state.isPaused || state.phase !== "hearing") return;
    pendingBeat = null;
    runBeat(beat);
    scriptIndex += 1;
    if (speechGated) {
      awaitingSpeech = true;
      return;
    }
    scheduleNextBeat();
  };

  const scheduleNextBeat = () => {
    if (state.isPaused || state.phase !== "hearing" || awaitingSpeech) return;
    if (scriptIndex >= script.length) {
      finishHearing();
      return;
    }
    const beat = script[scriptIndex];
    pendingBeat = beat;
    const thinkMs = beat.thinkMs ?? 0;

    const runPendingBeat = () => {
      if (!pendingBeat || state.isPaused || state.phase !== "hearing") return;
      playBeat(pendingBeat);
    };

    if (thinkMs > 0 && beat.role !== "clerk") {
      state = { ...state, isThinking: true, activeSpeaker: beat.role };
      emit({ type: "thinking", active: true });
      emit({ type: "speakerChange", role: beat.role });
      scriptTimer = setTimeout(runPendingBeat, thinkMs);
    } else {
      scriptTimer = setTimeout(runPendingBeat, beat.delayMs);
    }
  };

  const startTick = () => {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (
        state.isPaused ||
        state.phase === "setup" ||
        state.phase === "processing" ||
        state.phase === "agentsReady" ||
        state.phase === "judgment"
      )
        return;
      state = { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
      emit({ type: "tick", elapsedSeconds: state.elapsedSeconds });
    }, 1000);
  };

  return {
    getState: () => state,

    start(sessionConfig: CourtroomSessionConfig) {
      if (scriptTimer) clearTimeout(scriptTimer);
      if (tickTimer) clearInterval(tickTimer);
      config = sessionConfig;
      script = buildScript(sessionConfig);
      scriptIndex = 0;
      objectionPending = false;
  // Preserve speechGating: do NOT reset to false on start
  speechGated = speechGated; // keep prior preference; page sets after start
  awaitingSpeech = false;
  pendingBeat = null;
      const preset = sessionConfig.presetId ? getDemoPreset(sessionConfig.presetId) : undefined;
      state = {
        ...initialState(),
        phase: "hearing",
        exhibits: [...sessionConfig.exhibits],
        authorities: preset ? [...preset.authorities] : [],
        judgeNote: "Court is in session",
      };
      preset?.authorities.forEach((a) => emit({ type: "authorityCited", authority: a }));
      emit({ type: "phaseChange", phase: "hearing" });
      startTick();
      scheduleNextBeat();
    },

    pause() {
      if (state.isPaused || state.phase !== "hearing") return;
      state = { ...state, isPaused: true };
      if (scriptTimer) clearTimeout(scriptTimer);
      scriptTimer = null;
      emit({ type: "paused", paused: true });
    },

    resume() {
      if (!state.isPaused || state.phase !== "hearing") return;
      state = { ...state, isPaused: false };
      emit({ type: "paused", paused: false });
      if (!awaitingSpeech) {
        if (pendingBeat && !scriptTimer) {
          scheduleNextBeat();
        } else if (!scriptTimer) {
          scheduleNextBeat();
        }
      }
    },

    setSpeechGated(enabled: boolean) {
      speechGated = enabled;
      if (!enabled && awaitingSpeech) {
        awaitingSpeech = false;
        scheduleNextBeat();
      }
    },

    advanceScript() {
      if (!awaitingSpeech || state.isPaused || state.phase !== "hearing") return;
      awaitingSpeech = false;
      scheduleNextBeat();
    },

    revealJudgment() {
      if (state.phase !== "deliberation" || !state.judgment) return;
      state = {
        ...state,
        phase: "judgment",
        judgeState: "ruling",
        activeSpeaker: "judge",
        judgeNote: "Delivering simulated judgment",
      };
      emit({ type: "judgeState", state: "ruling", note: "Delivering simulated judgment" });
      emit({ type: "phaseChange", phase: "judgment" });
      emit({ type: "speakerChange", role: "judge" });
    },

    isAwaitingSpeech() {
      return awaitingSpeech;
    },

    endArguments() {
      if (state.phase !== "hearing") return;
      if (scriptTimer) clearTimeout(scriptTimer);
      scriptTimer = null;
      scriptIndex = script.length;
      finishHearing();
    },

    raiseObjection(type: ObjectionType) {
      if (state.phase !== "hearing" || objectionPending) return;
      objectionPending = true;
      const by: SpeakerRole = state.activeSpeaker === "respondent" ? "petitioner" : "respondent";
      const ruling = type === "procedure" ? "sustained" : type === "hearsay" ? "overruled" : "sustained";
      const noteEn = ruling === "sustained" ? "The objection is sustained." : "The objection is overruled.";
      const noteHi = ruling === "sustained" ? "आपत्ति स्वीकार की जाती है।" : "आपत्ति खारिज की जाती है।";
      const event = {
        id: `obj-${Date.now()}`,
        by,
        type,
        ruling,
        timestamp: state.elapsedSeconds,
        note: noteEn,
      } as const;
      state = { ...state, objections: [...state.objections, event] };
      emit({ type: "objectionRuling", event });
      const metricsDelta =
        ruling === "sustained"
          ? { proceduralCompliance: Math.min(1, state.metrics.proceduralCompliance + 0.05) }
          : { argumentStrength: Math.min(1, state.metrics.argumentStrength + 0.03) };
      updateMetrics(metricsDelta);
      const entry: TranscriptEntry = {
        id: `t-obj-${Date.now()}`,
        speaker: "Hon'ble AI Judge",
        role: "judge",
        text: `${noteEn} (${type} objection)`,
        textHi: `${noteHi} (${type} आपत्ति)`,
        timestamp: state.elapsedSeconds,
      };
      state = { ...state, transcript: [...state.transcript, entry], judgeState: "ruling" };
      emit({ type: "transcript", entry });
      emit({ type: "judgeState", state: "ruling", note: event.note });
      setTimeout(() => {
        objectionPending = false;
        state = { ...state, judgeState: "listening" };
        emit({ type: "judgeState", state: "listening" });
      }, 2000);
    },

    subscribe(listener: CourtroomListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      if (scriptTimer) clearTimeout(scriptTimer);
      if (tickTimer) clearInterval(tickTimer);
      listeners.clear();
      state = initialState();
    },
  };
}
