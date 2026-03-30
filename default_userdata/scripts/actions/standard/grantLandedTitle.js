//Made by: a dude

/**@typedef {import('../../gamedata_typedefs.js').GameData} GameData */

const TITLE_KEY_RE = /^[bcdke]_[a-z0-9_]+$/;

const TIER_HINTS = [
	{ regex: /\bbaron(y|ial)?\b|\bbarony\b|\bcastle\b|\bbaron\b|\bbaroness\b/, prefix: "b_" },
	{ regex: /\bcount(y|ies)?\b|\bcounty\b|\bearldom\b|\bcount\b|\bcountess\b|\bearl\b/, prefix: "c_" },
	{ regex: /\bduch(y|ies)?\b|\bduchy\b|\bduke\b|\bduchess\b/, prefix: "d_" },
	{ regex: /\bkingdom\b|\brealm\b|\bking\b|\bqueen\b/, prefix: "k_" },
	{ regex: /\bempire\b|\bimperial\b|\bemperor\b|\bempress\b/, prefix: "e_" }
];


function cleanTokenInput(value) {
	return String(value || "")
		.toLowerCase()
		.trim()
		.replace(/^title:/, "")
		.replace(/["'`]/g, "")
		.replace(/[^a-z0-9_\s-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeTitleInput(value) {
	let text = cleanTokenInput(value);
	if (!text) {
		return "";
	}

	// If user already supplied something close to a title key, keep it.
	let direct = text.replace(/[\s-]+/g, "_").replace(/_+/g, "_");
	if (TITLE_KEY_RE.test(direct)) {
		return direct;
	}

	let prefix = "";
	for (const hint of TIER_HINTS) {
		if (hint.regex.test(text)) {
			prefix = hint.prefix;
			text = text.replace(hint.regex, " ");
			break;
		}
	}

	text = text
		.replace(/\b(i|you|me|my|your|we|our|us|grant|give|transfer|bestow)\b/g, " ")
		.replace(/\b(title|landed|holding|holdings|of|the|a|an|to|for)\b/g, " ")
		.replace(/[\s-]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");

	if (!text || !prefix) {
		return "";
	}

	const output = `${prefix}${text}`;
	return TITLE_KEY_RE.test(output) ? output : "";
}

function toDirectTitleKey(value) {
	const cleaned = cleanTokenInput(value)
		.replace(/[\s-]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");
	return TITLE_KEY_RE.test(cleaned) ? cleaned : "";
}

function formatTitleKeyForDisplay(titleKey) {
	if (!TITLE_KEY_RE.test(String(titleKey || ""))) {
		return String(titleKey || "");
	}

	const key = String(titleKey).toLowerCase();
	const tierPrefix = key[0];
	const body = key.slice(2).replace(/_/g, " ").trim();
	if (!body) {
		return key;
	}

	const tierLabel = {
		b: "barony",
		c: "county",
		d: "duchy",
		k: "kingdom",
		e: "empire"
	}[tierPrefix];

	return tierLabel ? `${tierLabel} of ${body}` : key;
}

module.exports = {
	signature: "grantLandedTitle",
	args: [
		{
			name: "titleInput",
			type: "string",
			desc: {
				en: "Title to transfer from {{character1Name}} to {{character2Name}}. Use a title key like c_york, or a name-like text such as 'county of york'.",
				zh: "从{{character1Name}}转移给{{character2Name}}的头衔。可使用如 c_york 的头衔键，或类似“york伯爵领”的名称输入。",
				ru: "Титул для передачи от {{character1Name}} к {{character2Name}}. Используйте ключ титула (например c_york) или текст вида 'county of york'.",
				fr: "Titre a transferer de {{character1Name}} a {{character2Name}}. Utilisez une cle comme c_york, ou un texte du type 'county of york'.",
				es: "Titulo a transferir de {{character1Name}} a {{character2Name}}. Usa una clave como c_york o texto tipo 'county of york'.",
				de: "Titel, der von {{character1Name}} an {{character2Name}} uebertragen wird. Verwende einen Titel-Schluessel wie c_york oder Text wie 'county of york'.",
				ja: "{{character1Name}}から{{character2Name}}へ譲渡する称号。c_york のようなキー、または 'county of york' のような入力を使用できます。",
				ko: "{{character1Name}}에서 {{character2Name}}에게 이전할 작위입니다. c_york 같은 키 또는 'county of york' 같은 텍스트를 사용할 수 있습니다.",
				pl: "Tytul do przekazania od {{character1Name}} do {{character2Name}}. Uzyj klucza, np. c_york, albo tekstu typu 'county of york'.",
				pt: "Titulo para transferir de {{character1Name}} para {{character2Name}}. Use uma chave como c_york ou texto como 'county of york'."
			}
		}
	],
	description: {
		en: "Executed when one character grants a landed title to another. The source (character1) is the GRANTER. The target (character2) is the RECEIVER.",
		zh: "当一个角色将其拥有的领地头衔授予另一个角色时执行。发起者（character1）是授予者，目标（character2）是接收者。",
		ru: "Выполняется, когда один персонаж передает земельный титул другому. Источник (character1) — ДАРИТЕЛЬ, цель (character2) — ПОЛУЧАТЕЛЬ.",
		fr: "Execute lorsqu'un personnage accorde un titre foncier a un autre. La source (character1) est le DONATEUR. La cible (character2) est le RECEVEUR.",
		es: "Se ejecuta cuando un personaje concede un titulo territorial a otro. La fuente (character1) es quien OTORGA. El objetivo (character2) es el RECEPTOR.",
		de: "Wird ausgefuehrt, wenn ein Charakter einem anderen einen Landtitel uebertraegt. Quelle (character1) ist der GEBER, Ziel (character2) der EMPFAENGER.",
		ja: "あるキャラクターが別のキャラクターに領地称号を譲渡したときに実行されます。source (character1) は譲渡者、target (character2) は受領者です。",
		ko: "한 캐릭터가 다른 캐릭터에게 영지 작위를 수여할 때 실행됩니다. source(character1)는 수여자, target(character2)는 수령자입니다.",
		pl: "Wykonywane, gdy jedna postac nadaje drugiej ziemski tytul. Zrodlo (character1) to NADAJACY, cel (character2) to ODBIORCA.",
		pt: "Executado quando um personagem concede um titulo territorial a outro. A fonte (character1) e quem CONCEDE. O alvo (character2) e o RECEPTOR."
	},

	/**
	 * @param {GameData} gameData
	 * @param {number} sourceId
	 * @param {number} targetId
	 */
	check: (gameData, sourceId, targetId) => {
		console.log(`[grantLandedTitle.check] Checking with sourceId: ${sourceId}, targetId: ${targetId}`);
		const source = gameData.getCharacterById(sourceId);
		const target = gameData.getCharacterById(targetId);
		if (!source || !target || sourceId === targetId) {
			console.log(`[grantLandedTitle.check] Failing because source/target is missing or the same. Source: ${!!source}, Target: ${!!target}, IDs equal: ${sourceId === targetId}`);
			return false;
		}
		// The deferred check was preventing the action from being available on the first pass.
		// It's removed to ensure actions are checked correctly on immediate user prompts.
		return true;
	},

	/**
	 * @param {GameData} gameData
	 * @param {string[]} args
	 * @param {number} sourceId
	 * @param {number} targetId
	 * @returns {{success: boolean, message?: string}}
	 */
	preCheck: (gameData, args, sourceId, targetId) => {
		const source = gameData.getCharacterById(sourceId);
		const target = gameData.getCharacterById(targetId);

		if (!source || !target) {
			return { success: false, message: "Source or target character not found." };
		}

		if (sourceId === targetId) {
			return { success: false, message: "Source and target must be different characters." };
		}

		const rawInput = args[0] ? String(args[0]) : "";
		if (!rawInput.trim()) {
			return { success: false, message: "Please specify a title (e.g. c_york or 'county of york')." };
		}

		const directKey = toDirectTitleKey(rawInput);
		const hasTierHint = TIER_HINTS.some(hint => hint.regex.test(cleanTokenInput(rawInput)));
		if (!directKey && !hasTierHint) {
			return {
				success: false,
				message: "Please include a title tier (county/duchy/kingdom/empire) or use an exact key like d_moravia."
			};
		}

		const normalized = normalizeTitleInput(rawInput);
		if (!normalized) {
			return {
				success: false,
				message: "Could not resolve title input. Use an exact key like c_york, or include a tier like 'county of york'/'duchy of ...'."
			};
		}

		if (!TITLE_KEY_RE.test(normalized)) {
			return {
				success: false,
				message: `Resolved title '${normalized}' is invalid. Allowed prefixes: b_, c_, d_, k_, e_.`
			};
		}

		// Keep chat output and run effect aligned with normalized key.
		args[0] = normalized;
		return { success: true };
	},

	/**
	 * @param {GameData} gameData
	 * @param {Function} runGameEffect
	 * @param {string[]} args
	 * @param {number} sourceId
	 * @param {number} targetId
	 */
	run: (gameData, runGameEffect, args, sourceId, targetId) => {
		const source = gameData.getCharacterById(sourceId);
		const target = gameData.getCharacterById(targetId);
		if (!source || !target || sourceId === targetId) {
			return;
		}

		const normalizedTitle = normalizeTitleInput(args[0]);
		if (!TITLE_KEY_RE.test(normalizedTitle)) {
			return;
		}
		args[0] = normalizedTitle;

		runGameEffect(`
			global_var:votcce_action_source = { save_scope_as = grant_source }
			global_var:votcce_action_target = { save_scope_as = grant_target }

			if = {
				limit = {
					exists = title:${normalizedTitle}
				}
				if = {
					limit = {
						title:${normalizedTitle} = {
							holder = scope:grant_source
						}
					}
					create_title_and_vassal_change = {
						type = granted
						save_scope_as = title_change
						add_claim_on_loss = no
					}
					title:${normalizedTitle} = {
						change_title_holder = {
							holder = scope:grant_target
							change = scope:title_change
						}
					}
					resolve_title_and_vassal_change = scope:title_change

					if = {
						limit = {
							title:${normalizedTitle} = {
								holder = scope:grant_source
							}
						}
						scope:grant_target = {
							become_title_holder_effect = {
								TITLE = title:${normalizedTitle}
							}
						}
					}
				}
				else_if = {
					limit = {
						title:${normalizedTitle} = {
							holder = scope:grant_target
						}
					}
					create_title_and_vassal_change = {
						type = granted
						save_scope_as = title_change
						add_claim_on_loss = no
					}
					title:${normalizedTitle} = {
						change_title_holder = {
							holder = scope:grant_source
							change = scope:title_change
						}
					}
					resolve_title_and_vassal_change = scope:title_change

					if = {
						limit = {
							title:${normalizedTitle} = {
								holder = scope:grant_target
							}
						}
						scope:grant_source = {
							become_title_holder_effect = {
								TITLE = title:${normalizedTitle}
							}
						}
					}
				}
			}
		`);

		console.log(`[grantLandedTitle] Attempting transfer of '${normalizedTitle}' from ${source.shortName} to ${target.shortName}.`);
	},

	chatMessage: (args) => {
		const displayTitle = formatTitleKeyForDisplay(args[0]);
		return {
			en: `{{character1Name}} granted the landed title ${displayTitle} to {{character2Name}}.`,
			zh: `{{character1Name}}将领地头衔${displayTitle}授予了{{character2Name}}。`,
			ru: `{{character1Name}} передал(а) земельный титул ${displayTitle} персонажу {{character2Name}}.`,
			fr: `{{character1Name}} a accordé le titre foncier ${displayTitle} à {{character2Name}}.`,
			es: `{{character1Name}} concedió el título territorial ${displayTitle} a {{character2Name}}.`,
			de: `{{character1Name}} hat den Landtitel ${displayTitle} an {{character2Name}} übertragen.`,
			ja: `{{character1Name}}は領地称号${displayTitle}を{{character2Name}}に授与しました。`,
			ko: `{{character1Name}}가 영지 작위 ${displayTitle}을(를) {{character2Name}}에게 수여했습니다.`,
			pl: `{{character1Name}} przekazał(a) tytuł ziemski ${displayTitle} postaci {{character2Name}}.`,
			pt: `{{character1Name}} concedeu o título territorial ${displayTitle} para {{character2Name}}.`
		};
	},

	chatMessageClass: "neutral-action-message"
};
