export interface BattleCommitTarget {
    targetEpoch: number;
    transitionToken?: number;
    observedEpoch?: number;
    observedNodeA: number;
    observedNodeB: number;
    observedParentA?: number;
    observedParentB?: number;
    observedToken?: number;
    targetNodeA: number;
    targetNodeB: number;
    graphParentA: number;
    graphParentB: number;
    deliveryId?: string;
}

export interface BattleReportRunScriptParams {
    slotNumber: string;
    attemptId: string;
    playerId: string;
    escapedReport: string;
    commit?: BattleCommitTarget;
    /**
     * Mod-emitted battle delivery id (numeric, per-battle occurrence evidence).
     * When present, the arrival script guards slot cleanup by matching this
     * id against the in-save `votc_battle_report_<slot>_delivery_id` variable,
     * so a stale arrival from a prior battle does not wipe a newer slot's
     * state (§10.1 arrival contract: slot cleanup guarded by deliveryId).
     */
    battleDeliveryId?: number;
}

const GUARD_DISPLAY_VARIABLE = "votc_battle_report_guard_display";

function buildDisplayBlock(escapedReport: string): string[] {
    return [
        "send_interface_message = {",
        "\ttype = votc_message_popup",
        "\ttitle = votc_battle_report_message_title",
        `\tdesc = "${escapedReport}"`,
        "}",
        "create_artifact = {",
        "\tname = votc_battle_report_message_title",
        `\tdescription = "${escapedReport}"`,
        "\ttype = journal",
        "\tvisuals = scroll",
        "\tcreator = root",
        "\tmodifier = artifact_monthly_minor_prestige_1_modifier",
        "}"
    ];
}

function buildCleanupLines(slotNumber: string): string[] {
    return [
        `remove_global_variable ?= votc_battle_report_${slotNumber}`,
        `remove_variable ?= votc_battle_report_${slotNumber}_timer`,
        `remove_variable ?= votc_battle_report_${slotNumber}_sent_day`,
        `remove_global_variable ?= votc_battle_report_${slotNumber}_delivery_id`,
        "remove_global_variable ?= votc_battle_report_pending",
        "remove_global_variable ?= votc_battle_report_pending_valid"
    ];
}

function indent(lines: string[], prefix: string): string[] {
    return lines.map(line => (line.length ? prefix + line : line));
}

function sanitizeDeliveryId(deliveryId: string | undefined): string {
    const digits = String(deliveryId ?? '').replace(/\D/g, '');
    return digits === '' ? '0' : digits;
}

function buildGuardedCommitScript(params: BattleReportRunScriptParams, commit: BattleCommitTarget): string {
    const identityFields = [
        "2",
        "1",
        params.playerId || "0",
        "battle",
        params.slotNumber,
        sanitizeDeliveryId(commit.deliveryId)
    ].join("/;/");
    const attemptFields = [
        commit.observedEpoch ?? 0,
        commit.observedNodeA,
        commit.observedNodeB,
        commit.observedParentA ?? 0,
        commit.observedParentB ?? 0,
        commit.observedToken ?? 0,
        commit.graphParentA,
        commit.graphParentB,
        commit.targetEpoch,
        commit.targetNodeA,
        commit.targetNodeB
    ].join("/;/");
    const liveCk3State = (inPlayerScope: boolean) => {
        const read = (name: string) => inPlayerScope
            ? `[THIS.Var('${name}').GetValue|0]`
            : `[GetPlayer.MakeScope.Var('${name}').GetValue|0]`;
        return [
            read("votc_checkpoint_epoch"),
            read("votc_timeline_node_a"),
            read("votc_timeline_node_b"),
            read("votc_timeline_parent_a"),
            read("votc_timeline_parent_b"),
            read("votc_checkpoint_token")
        ].join("/;/");
    };
    const resultLog = (code: string, inPlayerScope = true) =>
        `debug_log = "VOTC:TIMELINE/;/commit_result/;/${params.attemptId}/;/${code}/;/${identityFields}/;/${attemptFields}/;/${liveCk3State(inPlayerScope)}"`;
    const commitLog = `debug_log = "VOTC:TIMELINE/;/commit/;/${params.attemptId}/;/${identityFields}/;/${commit.targetEpoch}/;/${commit.targetNodeA}/;/${commit.targetNodeB}/;/${commit.graphParentA}/;/${commit.graphParentB}"`;
    const displayFlag = `set_variable = { name = ${GUARD_DISPLAY_VARIABLE} value = 1 }`;

    const epochLimitLines = [`var:votc_checkpoint_epoch = ${commit.targetEpoch}`];
    if (typeof commit.transitionToken === "number" && Number.isInteger(commit.transitionToken) && commit.transitionToken > 0) {
        epochLimitLines.push(`var:votc_checkpoint_token = ${commit.transitionToken}`);
    }

    // §10.1 arrival guard: slot cleanup is guarded by deliveryId. When the
    // run script carries a numeric battleDeliveryId, require the in-save
    // global `votc_battle_report_<slot>_delivery_id` to match before any
    // display, node write or cleanup. The delivery id intentionally lives
    // outside the transient saved character scope used by a console run
    // script. A stale arrival from a prior battle (whose delivery id no
    // longer matches the slot's current value) logs
    // `skip_delivery_mismatch` and does not touch the slot.
    const deliveryIdGuardLines = (typeof params.battleDeliveryId === "number" && params.battleDeliveryId > 0)
        ? [
            `\t\texists = global_var:votc_battle_report_${params.slotNumber}_delivery_id`,
			`\t\tglobal_var:votc_battle_report_${params.slotNumber}_delivery_id = ${params.battleDeliveryId}`
        ]
        : [];

    const lines: string[] = [
        "if = {",
        "\tlimit = {",
        `\t\texists = global_var:votc_battle_report_${params.slotNumber}`,
        ...deliveryIdGuardLines,
        "\t}",
        `\t\tremove_variable ?= ${GUARD_DISPLAY_VARIABLE}`,
        `\t\t${commitLog}`,
        "\t\tif = {",
        "\t\t\tlimit = {",
        ...indent(epochLimitLines, "\t\t\t\t"),
        "\t\t\t}",
        "\t\t\tif = {",
        "\t\t\t\tlimit = {",
        `\t\t\t\t\tvar:votc_timeline_node_a = ${commit.targetNodeA}`,
        `\t\t\t\t\tvar:votc_timeline_node_b = ${commit.targetNodeB}`,
        "\t\t\t\t}",
        ...indent([resultLog("already_applied"), displayFlag], "\t\t\t\t"),
        "\t\t\t}",
        "\t\t\telse_if = {",
        "\t\t\t\tlimit = {",
        `\t\t\t\t\tvar:votc_timeline_node_a = ${commit.observedNodeA}`,
        `\t\t\t\t\tvar:votc_timeline_node_b = ${commit.observedNodeB}`,
        "\t\t\t\t}",
        `\t\t\t\tset_variable = { name = votc_timeline_node_a value = ${commit.targetNodeA} }`,
        `\t\t\t\tset_variable = { name = votc_timeline_node_b value = ${commit.targetNodeB} }`,
        `\t\t\t\tset_variable = { name = votc_timeline_parent_a value = ${commit.graphParentA} }`,
        `\t\t\t\tset_variable = { name = votc_timeline_parent_b value = ${commit.graphParentB} }`,
        "\t\t\t\tset_variable = { name = votc_timeline_schema value = 1 }",
        `\t\t\t\tdebug_log = "VOTC:CHECKPOINT/;/set/;/[THIS.Char.GetID]/;/${commit.targetEpoch}/;/${commit.targetNodeA}/;/${commit.targetNodeB}/;/${commit.graphParentA}/;/${commit.graphParentB}/;/[GetCurrentDate.GetStringShort]"`,
        ...indent([resultLog("applied"), displayFlag], "\t\t\t\t"),
        "\t\t\t}",
        "\t\t\telse = {",
        ...indent([resultLog("ambiguous_node"), displayFlag], "\t\t\t\t"),
        "\t\t\t}",
        "\t\t}",
        "\t\telse_if = {",
        "\t\t\tlimit = {",
        `\t\t\t\tvar:votc_checkpoint_epoch > ${commit.targetEpoch}`,
        "\t\t\t}",
        ...indent([resultLog("skipped_advanced"), displayFlag], "\t\t\t"),
        "\t\t}",
        "\t\telse = {",
        ...indent([resultLog("ambiguous_state")], "\t\t\t"),
        "\t\t}",
        "\t\tif = {",
        "\t\t\tlimit = {",
        `\t\t\t\thas_variable = ${GUARD_DISPLAY_VARIABLE}`,
        "\t\t\t}",
        `\t\t\tremove_variable = ${GUARD_DISPLAY_VARIABLE}`,
        ...indent(buildDisplayBlock(params.escapedReport), "\t\t\t"),
        ...indent(buildCleanupLines(params.slotNumber), "\t\t\t"),
        "\t\t}",
        "}",
        "else = {",
        ...indent([resultLog("skip_delivery_mismatch", false)], "\t"),
        "}"
    ];
    return lines.join("\n");
}

/**
 * A battle can lack enough snapshot evidence for a safe timeline transition.
 * It must still be delivered, but its slot cleanup remains correlated to the
 * mod-provided delivery id so a stale fallback cannot clear a newer report.
 */
function buildGuardedDeliveryOnlyScript(params: BattleReportRunScriptParams): string {
    if (typeof params.battleDeliveryId !== "number" || params.battleDeliveryId <= 0) {
        return [
            ...buildDisplayBlock(params.escapedReport),
            ...buildCleanupLines(params.slotNumber)
        ].join("\n");
    }

    const lines: string[] = [
        "if = {",
        "\tlimit = {",
        `\t\texists = global_var:votc_battle_report_${params.slotNumber}`,
        `\t\texists = global_var:votc_battle_report_${params.slotNumber}_delivery_id`,
        `\t\tglobal_var:votc_battle_report_${params.slotNumber}_delivery_id = ${params.battleDeliveryId}`,
        "\t}",
        ...indent(buildDisplayBlock(params.escapedReport), "\t\t"),
        ...indent(buildCleanupLines(params.slotNumber), "\t\t"),
        "}",
        "else = {",
        `\tdebug_log = "VOTC:BATTLE_REPORT/;/skip_delivery_mismatch/;/${params.attemptId}/;/${params.slotNumber}/;/${params.battleDeliveryId}"`,
        "}"
    ];
    return lines.join("\n");
}

export function buildBattleReportRunScript(params: BattleReportRunScriptParams): string {
    if (params.commit) {
        return buildGuardedCommitScript(params, params.commit);
    }

    return buildGuardedDeliveryOnlyScript(params);
}
