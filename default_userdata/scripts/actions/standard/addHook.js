/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const HOOK_TYPES = [
  { value: 'favor_hook',  display: { en: 'Favor — a solemn promise or sworn oath of future aid', de: 'Gefallen — feierliches Versprechen', es: 'Favor — promesa solemne', fr: 'Faveur — promesse solennelle', ja: '好意 — 厳粛な誓い', ko: '호의 — 엄숙한 서약', pl: 'Przysługa — uroczysta obietnica', pt: 'Favor — promessa solene', ru: 'Услуга — торжественная клятва', zh: '人情 — 庄严的誓言' }},
  { value: 'strong_hook', display: { en: 'Strong Hook — life debt, unforgivable secret, or absolute leverage', de: 'Starker Druck — Lebensschuld', es: 'Gancho fuerte — deuda de vida', fr: 'Forte emprise — dette de vie', ja: '強み — 命の借り', ko: '강한 빚 — 생명의 빚', pl: 'Silny hak — dług życia', pt: 'Gancho forte — dívida de vida', ru: 'Сильный компромат — долг жизни', zh: '强牵制 — 生死之债' }}
];

module.exports = {
  signature: "addHook",
  args: [
    {
      name: "hookType",
      type: "enum",
      options: HOOK_TYPES.map(ht => ht.value),
      desc: {
        en: `Type of hook that source (character1, who GAINS power) now holds over target (character2, who OWES). CRITICAL: only use when target has EXPLICITLY AGREED or SWORN. DO NOT use if target refused ("I cannot", "no") or only offered silence/secrecy. favor_hook = sworn oaths, solemn vows, "I give you my word", knightly promises. strong_hook = life debts, "you saved my life", absolute ruin if secret revealed.`,
        zh: `源（character1，获得权力）对目标（character2，欠人情）持有的牵制类型。关键：仅在目标明确同意或发誓时使用。目标拒绝或只提供沉默时不要使用。favor_hook = 宣誓、庄严承诺。strong_hook = 救命之恩、不可饶恕的秘密。`,
        ru: `Тип компромата у источника (character1, кто ПОЛУЧАЕТ власть) на цель (character2, кто ДОЛЖЕН). КРИТИЧНО: только когда цель ЯВНО СОГЛАСИЛАСЬ. НЕ использовать при отказе или молчании. favor_hook = клятвы, обеты. strong_hook = долг жизни.`,
        fr: `Type d'emprise de la source (character1, qui OBTIENT le pouvoir) sur la cible (character2, qui DOIT). CRITIQUE : uniquement si la cible a EXPLICITEMENT ACCEPTÉ. NE PAS utiliser si refus ou simple silence. favor_hook = serments, vœux. strong_hook = dette de vie.`,
        es: `Tipo de gancho del origen (character1, quien OBTIENE poder) sobre el objetivo (character2, quien DEBE). CRÍTICO: solo cuando el objetivo ACEPTÓ EXPLÍCITAMENTE. NO usar si rechazó o solo ofreció silencio. favor_hook = juramentos, votos. strong_hook = deuda de vida.`,
        de: `Art des Druckmittels der Quelle (character1, erhält MACHT) auf das Ziel (character2, SCHULDET). KRITISCH: nur wenn Ziel AUSDRÜCKLICH ZUGESTIMMT hat. NICHT verwenden bei Ablehnung oder nur Schweigen. favor_hook = Schwüre, Gelübde. strong_hook = Lebensschuld.`,
        ja: `ソース（character1、力を得る側）がターゲット（character2、借りがある側）に対して持つフックの種類。重要：ターゲットが明示的に同意または誓約した場合のみ使用。拒否や沈黙のみの場合は使用しない。favor_hook = 厳粛な誓い、騎士の誓約。strong_hook = 命の借り。`,
        ko: `소스(character1, 권력 획득)가 타겟(character2, 빚짐)에 대해 가지는 후크 유형. 중요: 타겟이 명시적으로 동의 또는 맹세한 경우에만 사용. 거부나 침묵만 제공한 경우 사용 금지. favor_hook = 엄숙한 서약, 기사 맹세. strong_hook = 생명의 빚.`,
        pl: `Rodzaj haka źródła (character1, UZYSKUJE władzę) na celu (character2, JEST WINIEN). KRYTYCZNE: tylko gdy cel WYRAŹNIE ZGODZIŁ SIĘ. NIE używaj przy odmowie lub samym milczeniu. favor_hook = przysięgi, śluby. strong_hook = dług życia.`,
        pt: `Tipo de gancho da fonte (character1, GANHA poder) sobre o alvo (character2, DEVE). CRÍTICO: apenas quando o alvo CONCORDOU EXPLICITAMENTE. NÃO use se recusou ou só ofereceu silêncio. favor_hook = juramentos, votos. strong_hook = dívida de vida.`
      }
    },
    {
      name: "reason",
      type: "string",
      desc: {
        en: `Short reason for the hook (e.g. 'swore a knightly oath', 'pledged aid when called', 'life debt'). Only provide if the target EXPLICITLY agreed. If target refused, do NOT use this action at all — call noop() instead.`,
        zh: `获得牵制的简短原因（例如'宣誓骑士誓言'、'承诺在召唤时提供帮助'、'救命之恩'）。仅在目标明确同意时提供。如果目标拒绝了，根本不要使用此操作——调用noop()。`,
        ru: `Краткая причина (например, 'дал рыцарскую клятву', 'обещал помощь', 'долг жизни'). Только если цель ЯВНО согласилась. Если отказалась — не используйте это действие, вызовите noop().`,
        fr: `Raison courte (ex. 'a prêté serment de chevalier', 'a promis son aide'). Uniquement si la cible a EXPLICITEMENT accepté. Si refus, n'utilisez PAS cette action — appelez noop().`,
        es: `Razón corta (ej. 'juró voto de caballero', 'prometió ayuda'). Solo si el objetivo ACEPTÓ EXPLÍCITAMENTE. Si rechazó, NO use esta acción — llame a noop().`,
        de: `Kurzer Grund (z. B. 'Ritterschwur geleistet', 'Hilfe versprochen'). Nur wenn Ziel AUSDRÜCKLICH ZUGESTIMMT hat. Bei Ablehnung diese Aktion NICHT verwenden — noop() aufrufen.`,
        ja: `短い理由（例：「騎士の誓いを立てた」「援助を約束した」）。対象が明示的に同意した場合のみ。拒否された場合はこのアクションを使用せず、noop()を呼び出してください。`,
        ko: `짧은 이유 (예: '기사 서약을 했다', '도움을 약속했다'). 대상이 명시적으로 동의한 경우에만. 거부된 경우 이 액션을 사용하지 말고 noop()을 호출하세요.`,
        pl: `Krótki powód (np. 'złożył przysięgę rycerską', 'obiecał pomoc'). Tylko jeśli cel WYRAŹNIE ZGODZIŁ SIĘ. Jeśli odmówił, NIE używaj tej akcji — wywołaj noop().`,
        pt: `Razão curta (ex.: 'fez juramento de cavaleiro', 'prometeu ajuda'). Apenas se o alvo CONCORDOU EXPLICITAMENTE. Se recusou, NÃO use esta ação — chame noop().`
      }
    }
  ],
  description: {
    en: `CRITICAL — CALL THIS ACTION ONLY WHEN THE TARGET CHARACTER HAS EXPLICITLY AGREED, SWORN, OR COMMITTED to something. The target must have said "yes", "I swear", "I promise", "I will", "you have my word", or equivalent.

DO NOT call this action when:
- The character REFUSES: "I cannot", "I will not", "no", "I won't"
- The character only offers SILENCE: "I won't tell anyone", "this stays between us", "I'll keep quiet" — secrecy is NOT a hook!
- The character only expresses FEAR, CONCERN, or DOUBT without agreeing
- The character needs to "think about it" or gives a non-committal answer
- The request was made but the reply is ambiguous or evasive

ONLY CALL WHEN THERE IS A CLEAR, EXPLICIT COMMITMENT from the target. A hook represents POWER over someone — you cannot gain power over someone who said no.

When the action IS appropriate — THE SOURCE (character1, first ID) IS THE ONE WHO NOW HOLDS POWER OVER THE TARGET. THE TARGET (character2, second ID) IS THE ONE WHO OWES SOMETHING.

HOOK TYPE SELECTION RULES:
- favor_hook: solemn promise, sworn oath, "I give you my word", "call on me and I will answer", knightly vows, pledged aid
- strong_hook: life debt, saved someone's life, unforgivable secret, absolute ruin if revealed

IMPORTANT: If the target refused or only offered silence, call noop() instead. Always put the character who RECEIVES/GAINS the leverage as the FIRST ID (sourceId), and the character who OWES/IS BOUND as the SECOND ID (targetId).`,
    zh: `关键——仅当目标角色明确同意、发誓或承诺时才调用此操作。目标必须说了"是"、"我发誓"、"我保证"、"我会的"、"你得到我的承诺"或类似话语。

不要调用此操作当：
- 角色拒绝："我不能"、"我不会"、"不"
- 角色只提供沉默："我不会告诉任何人"、"这仅限于我们之间"——保密不是牵制！
- 角色只表达恐惧、担忧或怀疑而未同意
- 请求被提出但回复模糊或回避

仅在目标有明确承诺时才调用。牵制代表对他人的权力——你不能对一个说了"不"的人获得权力。`,
    ru: `КРИТИЧНО — ВЫЗЫВАЙТЕ ТОЛЬКО КОГДА ЦЕЛЕВОЙ ПЕРСОНАЖ ЯВНО СОГЛАСИЛСЯ, ПОКЛЯЛСЯ ИЛИ ОБЯЗАЛСЯ. Цель должна была сказать "да", "клянусь", "обещаю", "я сделаю" или эквивалент.

НЕ ВЫЗЫВАЙТЕ когда:
- Персонаж ОТКАЗЫВАЕТСЯ: "я не могу", "я не буду", "нет"
- Персонаж предлагает только МОЛЧАНИЕ: "я никому не скажу" — молчание это НЕ компромат!
- Персонаж выражает СТРАХ или СОМНЕНИЕ без согласия

Только при ЯВНОМ ОБЯЗАТЕЛЬСТВЕ. Компромат — это власть. Нельзя получить власть над тем, кто сказал "нет".`,
    fr: `CRITIQUE — APPELEZ UNIQUEMENT LORSQUE LE PERSONNAGE CIBLE A EXPLICITEMENT ACCEPTÉ, JURÉ OU S'EST ENGAGÉ. La cible doit avoir dit "oui", "je le jure", "je promets", "je le ferai" ou équivalent.

N'APPELEZ PAS quand :
- Le personnage REFUSE : "je ne peux pas", "je ne veux pas", "non"
- Le personnage offre seulement le SILENCE : "je n'en parlerai à personne" — le silence n'est PAS une emprise !
- Le personnage exprime de la PEUR ou du DOUTE sans accord

Appelez seulement en cas d'ENGAGEMENT CLAIR. Une emprise est un pouvoir. On ne peut pas avoir de pouvoir sur quelqu'un qui a dit non.`,
    es: `CRÍTICO — LLAME SOLO CUANDO EL PERSONAJE OBJETIVO HA ACEPTADO, JURADO O SE HA COMPROMETIDO EXPLÍCITAMENTE. El objetivo debe haber dicho "sí", "lo juro", "prometo", "lo haré" o equivalente.

NO LLAME cuando:
- El personaje RECHAZA: "no puedo", "no lo haré", "no"
- El personaje solo ofrece SILENCIO: "no se lo diré a nadie" — ¡el silencio NO es un gancho!
- El personaje expresa MIEDO o DUDA sin aceptar

Llame solo cuando haya COMPROMISO CLARO. Un gancho es poder. No se puede tener poder sobre alguien que dijo no.`,
    de: `KRITISCH — NUR AUFRUFEN, WENN DER ZIELCHARAKTER AUSDRÜCKLICH ZUGESTIMMT, GESCHWOREN ODER SICH VERPFLICHTET HAT. Das Ziel muss "ja", "ich schwöre", "ich verspreche", "ich werde" oder Äquivalentes gesagt haben.

NICHT AUFRUFEN wenn:
- Der Charakter ABLEHNT: "ich kann nicht", "ich werde nicht", "nein"
- Der Charakter nur SCHWEIGEN anbietet: "ich sage es niemandem" — Schweigen ist KEIN Druckmittel!
- Der Charakter ANGST oder ZWEIFEL ohne Zustimmung äußert

Nur bei KLARER VERPFLICHTUNG aufrufen. Ein Druckmittel ist Macht. Man kann keine Macht über jemanden haben, der nein gesagt hat.`,
    ja: `重要 — 対象キャラクターが明示的に同意、誓約、または約束した場合のみ呼び出してください。対象が「はい」「誓います」「約束します」「やります」または同等のことを言った場合のみです。

以下の場合は呼び出さないでください：
- 拒否した場合：「できません」「やりません」「いいえ」
- 沈黙のみを提供した場合：「誰にも言いません」— 秘密保持はフックではありません！
- 同意なしに恐怖や疑念を表明した場合

明確なコミットメントがある場合のみ。フックは権力です。「いいえ」と言った人に対して権力を持つことはできません。`,
    ko: `중요 — 대상 캐릭터가 명시적으로 동의, 맹세 또는 약속한 경우에만 호출하세요. 대상이 "예", "맹세합니다", "약속합니다", "하겠습니다" 또는 이에 준하는 말을 한 경우에만 해당됩니다.

다음 경우에는 호출하지 마세요:
- 거부한 경우: "할 수 없습니다", "하지 않겠습니다", "아니요"
- 침묵만 제공한 경우: "아무에게도 말하지 않겠습니다" — 비밀 유지는 후크가 아닙니다!
- 동의 없이 두려움이나 의심만 표현한 경우

명확한 약속이 있을 때만 호출하세요. 후크는 권력입니다. "아니요"라고 말한 사람에 대해 권력을 가질 수 없습니다.`,
    pl: `KRYTYCZNE — WYWOŁUJ TYLKO GDY POSTAĆ DOCELOWA WYRAŹNIE ZGODZIŁA SIĘ, PRZYSIĘGŁA LUB ZOBOWIĄZAŁA SIĘ. Cel musi powiedzieć "tak", "przysięgam", "obiecuję", "zrobię to" lub odpowiednik.

NIE WYWOŁUJ gdy:
- Postać ODRZUCA: "nie mogę", "nie zrobię tego", "nie"
- Postać oferuje tylko MILCZENIE: "nikomu nie powiem" — milczenie NIE jest hakiem!
- Postać wyraża STRACH lub WĄTPLIWOŚCI bez zgody

Wywołuj tylko przy JASNYM ZOBOWIĄZANIU. Hak to władza. Nie można mieć władzy nad kimś, kto powiedział nie.`,
    pt: `CRÍTICO — CHAME APENAS QUANDO O PERSONAGEM ALVO CONCORDOU, JUROU OU SE COMPROMETEU EXPLICITAMENTE. O alvo deve ter dito "sim", "eu juro", "eu prometo", "eu farei" ou equivalente.

NÃO CHAME quando:
- O personagem RECUSA: "não posso", "não farei", "não"
- O personagem oferece apenas SILÊNCIO: "não contarei a ninguém" — sigilo NÃO é um gancho!
- O personagem expressa MEDO ou DÚVIDA sem concordar

Chame apenas quando houver COMPROMISSO CLARO. Um gancho é poder. Não se pode ter poder sobre alguém que disse não.`
  },

  /**
   * @param {GameData} gameData
   * @param {number} sourceId
   * @param {number} targetId
   */
  check: (gameData, sourceId, targetId) => {
    const source = gameData.getCharacterById(sourceId);
    const target = gameData.getCharacterById(targetId);
    if (!source || !target) return false;

    // Prevent self-hooks
    if (sourceId === targetId) return false;

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
    const target = gameData.getCharacterById(targetId);
    if (!target) {
      return { success: false, message: "Target character not found." };
    }

    const source = gameData.getCharacterById(sourceId);
    if (!source) {
      return { success: false, message: "Source character not found." };
    }

    const rawHookType = args[0] ? String(args[0]).trim() : "";
    if (!rawHookType) {
      return { success: false, message: "Please specify a hook type (e.g. 'favor_hook')." };
    }

    // Validate hook type
    const validHookTypes = HOOK_TYPES.map(ht => ht.value);
    if (!validHookTypes.includes(rawHookType)) {
      return {
        success: false,
        message: `Invalid hook type "${rawHookType}". Valid types: ${validHookTypes.join(', ')}.`
      };
    }

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
    if (!source) return;

    const target = gameData.getCharacterById(targetId);
    if (!target) return;

    const hookType = args[0];
    if (!hookType) return;

    const reason = args[1] ? String(args[1]) : '';

    // CK3 add_hook semantics: the SCOPED character GETS/OWNS the hook.
    //   scope.add_hook = { type = X, target = Y } means "scope now holds a hook on Y".
    // We scope to the SOURCE (character1) because they are the one GAINING the hook.
    // We set target to the TARGET (character2) because the hook is ON them.
    // Result: source (character1) HAS a hook ON target (character2). ✓
    //
    // Syntax: add_hook = { type = X, target = Y }
    // Optional: days/months/years = W (taken from hook type if omitted)
    runGameEffect(`
        global_var:votcce_action_source = {
            add_hook = {
                type = ${hookType}
                target = global_var:votcce_action_target
            }
        }`);

    console.log(`Hook '${hookType}' added: ${source.shortName} now has a hook on ${target.shortName}. Reason: ${reason}`);
  },

  chatMessage: (args) => {
    const hookType = args[0];
    const reason = args[1] ? String(args[1]) : '';

    // Friendly display name for the hook type
    const hookDisplayNames = {
      'favor_hook':  { en: 'a favor', de: 'einen Gefallen', es: 'un favor', fr: 'une faveur', ja: '好意', ko: '호의', pl: 'przysługę', pt: 'um favor', ru: 'услугу', zh: '一个人情' },
      'strong_hook': { en: 'a strong hook', de: 'ein starkes Druckmittel', es: 'un gancho fuerte', fr: 'une forte emprise', ja: '強み', ko: '강한 빚', pl: 'silny hak', pt: 'um gancho forte', ru: 'сильный компромат', zh: '一个强牵制' }
    };

    const displayInfo = hookDisplayNames[hookType] || hookDisplayNames['favor_hook'];

    return {
      en: `{{character1Name}} gained ${displayInfo.en} on {{character2Name}}.`,
      zh: `{{character1Name}}获得了对{{character2Name}}的${displayInfo.zh}。`,
      ru: `{{character1Name}} получил(а) ${displayInfo.ru} на {{character2Name}}.`,
      fr: `{{character1Name}} a obtenu ${displayInfo.fr} sur {{character2Name}}.`,
      es: `{{character1Name}} obtuvo ${displayInfo.es} sobre {{character2Name}}.`,
      de: `{{character1Name}} hat ${displayInfo.de} auf {{character2Name}} erhalten.`,
      ja: `{{character1Name}}は{{character2Name}}に対して${displayInfo.ja}を得ました。`,
      ko: `{{character1Name}}님이 {{character2Name}}에 대한 ${displayInfo.ko}를 얻었습니다.`,
      pl: `{{character1Name}} zyskał(a) ${displayInfo.pl} na {{character2Name}}.`,
      pt: `{{character1Name}} ganhou ${displayInfo.pt} sobre {{character2Name}}.`
    };
  },

  chatMessageClass: "neutral-action-message"
};
