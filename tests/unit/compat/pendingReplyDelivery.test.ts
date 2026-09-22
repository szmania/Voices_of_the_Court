/**
 * PR #15 pending-reply delivery compatibility.
 *
 * The pending queue survives upgrades, so it can hold replies from before
 * campaign stamping existed. This suite pins both halves of the delivery
 * decision: a reply whose campaign stamp contradicts the live game is kept
 * pending (never written into the wrong campaign), while a pre-upgrade reply
 * that carries no stamp at all is still delivered — leaving it unclaimed beats
 * either stranding it forever or claiming it for whichever campaign is loaded.
 */
import { app } from 'electron';
import { checkAndDeliverLetters, _private_getStoredLetters, _private_setConfig, _private_setCurrentTotalDays, _private_setLastLetterSentToGame, _private_setObservedCampaignIdProvider } from '../../../src/main/main';
import * as parseLog from '../../../src/shared/gameData/parseLog';
import { LetterManager } from '../../../src/main/letter/LetterManager';
import { evaluateReplyDeliveryGate } from '../../../src/main/letter/letterDeliveryGate';
import { buildIdentityFromParts } from '../../../src/shared/gameData/CampaignIdentity';

jest.mock('../../../src/shared/gameData/parseLog');
// userDataCheck imports Electron's original-fs, which does not exist under jest;
// the delivery path never calls it.
jest.mock('../../../src/main/userDataCheck', () => ({checkUserData: jest.fn()}));

// The delivery path only needs getInstance().deliverLetter; the automock would
// return undefined for getInstance and blow up before the assertion.
jest.mock('../../../src/main/letter/LetterManager', () => {
    const deliverLetter = jest.fn();
    const instance = {deliverLetter};
    return {
        LetterManager: {
            getInstance: () => instance,
            __mock: instance
        }
    };
});

const PLAYER_ID = '1001';
const AI_ID = '1002';
const IDENTITY = buildIdentityFromParts({a: 7, b: 8, c: 9, d: 10}, PLAYER_ID);
const OTHER_CAMPAIGN_ID = '111-222-333-444';

const gameDataWithCampaign: Record<string, unknown> = {
    playerID: Number(PLAYER_ID),
    aiID: Number(AI_ID),
    date: '1066.1.2',
    votcCheckpointEpoch: 0,
    timelineSnapshotResult: {
        status: 'valid',
        snapshot: {
            playerId: PLAYER_ID,
            source: 'init',
            epoch: 0,
            protocol: {
                protocolSchema: 2,
                campaignSchema: 1,
                campaignIdA: 7,
                campaignIdB: 8,
                campaignIdC: 9,
                campaignIdD: 10,
                campaignBootstrapKind: 1,
                playerTimelineSchema: 1
            }
        }
    }
};

// A save whose mod predates the v2 protocol tail: no campaign id is observable.
const gameDataWithoutCampaign: Record<string, unknown> = {
    playerID: Number(PLAYER_ID),
    aiID: Number(AI_ID),
    date: '1066.1.2',
    votcCheckpointEpoch: 0
};

function queueReply(id: string, stamp: string | undefined, recipientId: string = PLAYER_ID): void {
    _private_getStoredLetters().set(id, {
        letter: {id, recipient: {id: recipientId}, timelineCampaignId: stamp} as never,
        originalLetter: {id: `original-${id}`, totalDays: 100, delay: 0} as never,
        expectedDeliveryDay: 100
    });
}

function deliveryMock(): jest.Mock {
    return (LetterManager as unknown as {__mock: {deliverLetter: jest.Mock}}).__mock.deliverLetter;
}

describe('pending reply delivery gate', () => {
    beforeEach(() => {
        _private_getStoredLetters().clear();
        _private_setLastLetterSentToGame(null);
        _private_setCurrentTotalDays(100);
        _private_setConfig({userFolderPath: process.cwd()} as never);
        _private_setObservedCampaignIdProvider(null);
        deliveryMock().mockClear();
        (app.getPath as jest.Mock).mockReturnValue(process.cwd());
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('verdicts', () => {
        it('delivers a reply stamped for the campaign that is loaded', () => {
            expect(evaluateReplyDeliveryGate(
                {recipientId: PLAYER_ID, campaignId: IDENTITY.campaignId},
                {campaignId: IDENTITY.campaignId},
                PLAYER_ID
            )).toEqual({deliverable: true});
        });

        it('keeps a reply stamped for another campaign pending', () => {
            expect(evaluateReplyDeliveryGate(
                {recipientId: PLAYER_ID, campaignId: OTHER_CAMPAIGN_ID},
                {campaignId: IDENTITY.campaignId},
                PLAYER_ID
            )).toEqual({deliverable: false, reason: 'campaign_mismatch'});
        });

        it('fails closed on an unstamped reply unless the legacy exemption is requested', () => {
            expect(evaluateReplyDeliveryGate(
                {recipientId: PLAYER_ID},
                {campaignId: IDENTITY.campaignId},
                PLAYER_ID
            )).toEqual({deliverable: false, reason: 'reply_campaign_unknown'});

            expect(evaluateReplyDeliveryGate(
                {recipientId: PLAYER_ID},
                {campaignId: IDENTITY.campaignId},
                PLAYER_ID,
                {allowUnstampedLegacyReplies: true}
            )).toEqual({deliverable: true, reason: 'legacy_reply_unstamped'});
        });

        it('still checks the player on an exempted legacy reply', () => {
            expect(evaluateReplyDeliveryGate(
                {recipientId: '9999'},
                {campaignId: IDENTITY.campaignId},
                PLAYER_ID,
                {allowUnstampedLegacyReplies: true}
            )).toEqual({deliverable: false, reason: 'player_mismatch'});
        });

        it('keeps a stamped reply pending while the loaded save exposes no campaign', () => {
            expect(evaluateReplyDeliveryGate(
                {recipientId: PLAYER_ID, campaignId: IDENTITY.campaignId},
                undefined,
                PLAYER_ID
            )).toEqual({deliverable: false, reason: 'current_campaign_unknown'});
        });
    });

    describe('delivery loop', () => {
        it('deferred: a reply for another campaign is not written into the game', async () => {
            jest.spyOn(parseLog, 'parseLog').mockResolvedValue(gameDataWithCampaign as never);
            queueReply('reply-foreign', OTHER_CAMPAIGN_ID);

            await checkAndDeliverLetters();

            expect(deliveryMock()).not.toHaveBeenCalled();
            expect(_private_getStoredLetters().has('reply-foreign')).toBe(true);
        });

        it('delivered: a pre-upgrade reply without a campaign stamp still reaches the game', async () => {
            jest.spyOn(parseLog, 'parseLog').mockResolvedValue(gameDataWithCampaign as never);
            queueReply('reply-legacy', undefined);

            await checkAndDeliverLetters();

            expect(deliveryMock()).toHaveBeenCalledTimes(1);
            expect(_private_getStoredLetters().has('reply-legacy')).toBe(false);
        });

        it('delivered: a reply stamped for the loaded campaign is sent', async () => {
            jest.spyOn(parseLog, 'parseLog').mockResolvedValue(gameDataWithCampaign as never);
            queueReply('reply-current', IDENTITY.campaignId);

            await checkAndDeliverLetters();

            expect(deliveryMock()).toHaveBeenCalledTimes(1);
            expect(_private_getStoredLetters().has('reply-current')).toBe(false);
        });

        it('deferred: a pre-upgrade reply addressed to another player is not delivered', async () => {
            jest.spyOn(parseLog, 'parseLog').mockResolvedValue(gameDataWithCampaign as never);
            queueReply('reply-other-player', undefined, '9999');

            await checkAndDeliverLetters();

            expect(deliveryMock()).not.toHaveBeenCalled();
            expect(_private_getStoredLetters().has('reply-other-player')).toBe(true);
        });

        it('delivered: an unstamped reply still goes out when the mod exposes no campaign at all', async () => {
            jest.spyOn(parseLog, 'parseLog').mockResolvedValue(gameDataWithoutCampaign as never);
            queueReply('reply-legacy-mod', undefined);

            await checkAndDeliverLetters();

            expect(deliveryMock()).toHaveBeenCalledTimes(1);
            expect(_private_getStoredLetters().has('reply-legacy-mod')).toBe(false);
        });

        it('deferred: a campaign-mismatched reply is skipped, not re-parsed on every scheduler tick', async () => {
            // Same campaign the mocked log snapshot reports, so the skip
            // recorded at deferral time matches the observed campaign.
            _private_setObservedCampaignIdProvider(() => IDENTITY.campaignId);
            const parseSpy = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(gameDataWithCampaign as never);
            queueReply('reply-foreign-tick', OTHER_CAMPAIGN_ID);

            await checkAndDeliverLetters();
            const callsAfterFirstPass = parseSpy.mock.calls.length;
            expect(callsAfterFirstPass).toBeGreaterThan(0);
            expect(deliveryMock()).not.toHaveBeenCalled();

            await checkAndDeliverLetters();
            await checkAndDeliverLetters();

            expect(parseSpy.mock.calls.length).toBe(callsAfterFirstPass);
            expect(deliveryMock()).not.toHaveBeenCalled();
            expect(_private_getStoredLetters().has('reply-foreign-tick')).toBe(true);
        });
    });
});
