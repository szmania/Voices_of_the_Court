/** @import { GameData, Character } from '../../gamedata_typedefs.js' */

const VALID_LOCATIONS = [
  'alley_night',
  'alley_day',
  'armory',
  'battlefield',
  'temple',
  'corridor_night',
  'corridor_day',
  'council_chamber',
  'courtyard',
  'dungeon',
  'ocean',
  'terrain_travel',
  'docks',
  'farmland',
  'feast',
  'gallows',
  'garden',
  'market',
  'village',
  'burning_building',
  'sitting_room',
  'bedchamber',
  'study',
  'relaxing_room',
  'physicians_study',
  'tavern',
  'throne_room',
  'estate',
  'army_camp',
  'bath_house',
  'runestone',
  'runestone_circle',
  'beached_longships',
  'kitchen',
  'bonfire',
  'wine_cellar',
  'crossroads_inn',
  'cave',
  'tournament',
  'holy_site',
  'travel_bridge',
  'hunt_forest_hut',
  'hunt_forest_cave',
  'hunt_foggy_forest',
  'dog_kennels',
  'hunt_poachers_camp',
  'hunt_activity_camp',
  'wedding_ceremony',
  'involved_activity',
  'nursery',
  'university',
  'catacombs',
  'condemned_village',
  'funeral_pyre',
  'legendary_battlefield',
  'constantinople',
  'city_gate',
  'relaxing_tent',
  'survey',
  'terrain_settlement',
  'terrain_settlement_no_owner',
  'campfire',
  'camp',
  'camp_night',
  'military_tent',
  'village_festival',
  'coast',
  'city_steppe',
  'examination_room',
  'chinese_city',
  'japanese_city',
];

module.exports = {
    signature: "changeLocation",
    titleKey: "actions.changeLocation.title",
    args: [
        {
            name: "location",
            type: "enum",
            options: VALID_LOCATIONS,
            description: {
                en: "The new location to change the scene to.",
                zh: "要切换到的新场景位置。",
                ru: "Новое место для смены сцены.",
                fr: "Le nouvel emplacement où changer la scène.",
                es: "La nueva ubicación a la que cambiar la escena.",
                de: "Der neue Ort, zu dem die Szene wechseln soll.",
                ja: "シーンを切り替える新しい場所。",
                ko: "장면을 변경할 새 위치.",
                pl: "Nowa lokalizacja, na którą ma się zmienić scena."
            }
        }
    ],
    description: {
        en: `Changes the scene background.`,
        zh: `更改场景背景。`,
        ru: `Изменяет фон сцены.`,
        fr: `Change l'arrière-plan de la scène.`,
        es: `Cambia el fondo de la escena.`,
        de: `Ändert den Szenenhintergrund.`,
        ja: `シーンの背景を変更します。`,
        ko: `장면 배경을 변경합니다.`,
        pl: `Zmienia tło sceny.`
    },

    /**
     * @param {GameData} gameData
     * @param {number} sourceId
     * @param {number} targetId
     */
    check: (gameData, sourceId, targetId) => {
        return true;
    },

    /**
     * @param {GameData} gameData
     * @param {Function} runGameEffect
     * @param {string[]} args
     * @param {number} sourceId
     * @param {number} targetId
     */
    run: (gameData, runGameEffect, args, sourceId, targetId) => {
        const location = args[0] ? args[0].toLowerCase().trim() : "";

        if (!location) {
            console.error(`changeLocation: No location specified. Arguments: ${JSON.stringify(args)}`);
            return;
        }

        if (!VALID_LOCATIONS.includes(location)) {
            console.error(`changeLocation: Invalid location "${location}"`);
            return;
        }

        runGameEffect(`set_global_variable = { name = talk_scene value = flag:talk_scene_${location} }`);

        gameData.scene = location;
        gameData.location = location;
    },
    chatMessage: (args) =>{
        const location = args[0] || '';
        const locationName = location.replace(/_/g, ' ');
        return {
            en: `Scene changed to ${locationName}`,
            zh: `场景已切换至${locationName}`,
            ru: `Сцена изменена на ${locationName}`,
            fr: `Scène changée pour ${locationName}`,
            es: `Escena cambiada a ${locationName}`,
            de: `Szene geändert zu ${locationName}`,
            ja: `シーンが ${locationName} に変更されました`,
            ko: `장면이 ${locationName}(으)로 변경되었습니다`,
            pl: `Scena zmieniona na ${locationName}`
        }
    },
    chatMessageClass: "neutral-action-message"
};
