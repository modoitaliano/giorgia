import React, { useEffect, useMemo, useState } from 'react';
import {
  normalizeModoItalianoBracketDrawCommand,
  normalizeModoItalianoBracketMatches,
  normalizeModoItalianoBracketStartRound,
  type ModoItalianoBracketDrawCommand,
  type ModoItalianoBracketMatch,
  type ModoItalianoBracketStartRound
} from './bracketModel.js';
import { GIORGIA, giorgiaLabelStyle } from './giorgiaBroadcast.js';

/** The song fields the bracket renders; the host's catalog entries satisfy it structurally. */
export interface SongCatalogItem {
  id: number;
  artist: string;
  title: string;
  coverUrl?: string | null;
}

/** The props stored program scenes carry for `modoitaliano-bracket`, unchanged from the legacy bracket. */
export interface ModoItalianoBracketProps {
  title?: string;
  show?: boolean;
  startRound?: ModoItalianoBracketStartRound;
  matches?: ModoItalianoBracketMatch[];
  drawCommand?: ModoItalianoBracketDrawCommand;
  voters?: Array<{ id: string; name: string }>;
  matchVotes?: Record<string, Record<string, number | null>>;
  activeVotingMatchId?: number | null;
  votingWinnerId?: number | null;
  votingResultStartedAt?: number | null;
  loadSongCatalog: () => Promise<SongCatalogItem[]>;
}

/** One match: two song slots, each as tall as its square cover. */
const CARD_WIDTH_PX = 420;
const SLOT_HEIGHT_PX = 58;
/** Room above the bracket for the Giorgia clock's header, and below it for the final. */
const STAGE_TOP_PX = 196;
const STAGE_BOTTOM_PX = 318;
const LOSER_OPACITY = 0.38;
const VOTING_RESULT_MS = 10_000;
/** A vote's cover, large enough to read across the studio as it is revealed. */
const VOTE_COVER_PX = 280;
const HAIRLINE = '1px solid rgba(255,255,255,0.14)';

const eyebrow = (color: string): React.CSSProperties => ({ ...giorgiaLabelStyle, color, fontSize: '24px' });

const plate: React.CSSProperties = { background: GIORGIA.plate, border: HAIRLINE };

/**
 * The song tournament in Giorgia's broadcast language: square navy plates, condensed type, the magenta signal rule
 * on every winner and on the panels, and hard cuts. It keeps the legacy bracket's props and tournament model; only
 * the look changed. It leaves the top-left corner to the Giorgia clock's header and the bottom row to the final.
 */
export const ModoItalianoGiorgiaBracket: React.FC<ModoItalianoBracketProps> = ({
  show = true,
  startRound = 'roundOf16',
  matches = [],
  drawCommand = undefined,
  voters = [],
  matchVotes = {},
  activeVotingMatchId = null,
  votingWinnerId = null,
  votingResultStartedAt = null,
  loadSongCatalog
}) => {
  const [songs, setSongs] = useState<SongCatalogItem[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [drawStartedAtMs, setDrawStartedAtMs] = useState(0);
  const [votingNowMs, setVotingNowMs] = useState(() => Date.now());

  useEffect(() => {
    loadSongCatalog()
      .then(setSongs)
      .catch((err) => console.error('Failed to fetch songs for bracket:', err));
  }, [loadSongCatalog]);

  const normalizedDrawCommand = normalizeModoItalianoBracketDrawCommand(drawCommand);
  const drawEndsAtMs = normalizedDrawCommand && drawStartedAtMs > 0 ? drawStartedAtMs + normalizedDrawCommand.durationSeconds * 1000 : 0;
  const isDrawing = Boolean(normalizedDrawCommand && drawStartedAtMs > 0 && nowMs < drawEndsAtMs);

  useEffect(() => {
    setDrawStartedAtMs(normalizedDrawCommand ? Date.now() : 0);
  }, [normalizedDrawCommand?.id]);

  useEffect(() => {
    if (!normalizedDrawCommand || Date.now() >= drawEndsAtMs) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 120);
    return () => window.clearInterval(timer);
  }, [drawEndsAtMs, normalizedDrawCommand?.id]);

  useEffect(() => {
    if (typeof votingResultStartedAt !== 'number' || votingResultStartedAt <= 0) return;
    setVotingNowMs(Date.now());
    const timer = window.setInterval(() => setVotingNowMs(Date.now()), 120);
    return () => window.clearInterval(timer);
  }, [votingResultStartedAt]);

  const normalizedStartRound = normalizeModoItalianoBracketStartRound(startRound);
  const isQuarterfinalStart = normalizedStartRound === 'quarterfinals';
  const safeMatches = useMemo(() => normalizeModoItalianoBracketMatches(matches, normalizedStartRound), [matches, normalizedStartRound]);

  if (!show) return null;

  const getSong = (id: number | null) => songs.find((s) => s.id === id);

  const Cover = ({ song, size }: { song: SongCatalogItem | undefined; size: number }) =>
    song?.coverUrl ? (
      <img src={song.coverUrl} alt='' style={{ width: `${size}px`, height: `${size}px`, objectFit: 'cover', flexShrink: 0, display: 'block' }} />
    ) : null;

  const Slot = ({ song, mirrored, won, lost }: { song: SongCatalogItem | undefined; mirrored: boolean; won: boolean; lost: boolean }) => (
    <div
      data-giorgia-bracket-slot={won ? 'winner' : lost ? 'loser' : 'open'}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: mirrored ? 'row-reverse' : 'row',
        alignItems: 'center',
        height: `${SLOT_HEIGHT_PX}px`,
        opacity: lost ? LOSER_OPACITY : 1
      }}
    >
      {won ? <div aria-hidden='true' data-giorgia-rule style={{ position: 'absolute', top: 0, bottom: 0, [mirrored ? 'right' : 'left']: 0, width: `${GIORGIA.ruleWidth}px`, background: GIORGIA.signal }} /> : null}
      <Cover song={song} size={SLOT_HEIGHT_PX} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '3px',
          minWidth: 0,
          flex: 1,
          padding: `0 ${GIORGIA.ruleWidth + 12}px`,
          textAlign: mirrored ? 'right' : 'left'
        }}
      >
        {song ? (
          <>
            <span style={{ ...eyebrow('rgba(255,255,255,0.62)'), fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</span>
            <span style={{ fontFamily: GIORGIA.display, fontWeight: 800, fontSize: '24px', lineHeight: 1, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</span>
          </>
        ) : (
          <span style={{ ...eyebrow('rgba(255,255,255,0.4)'), fontSize: '18px' }}>TBD</span>
        )}
      </div>
    </div>
  );

  const MatchCard = ({ match, mirrored }: { match: ModoItalianoBracketMatch; mirrored: boolean }) => {
    const aWon = match.winnerId === match.songAId && match.songAId !== null;
    const bWon = match.winnerId === match.songBId && match.songBId !== null;
    return (
      <div data-giorgia-bracket-match={match.id} style={{ ...plate, width: `${CARD_WIDTH_PX}px`, flexShrink: 0 }}>
        <Slot song={getSong(match.songAId)} mirrored={mirrored} won={aWon} lost={Boolean(match.winnerId) && !aWon} />
        <div style={{ borderTop: HAIRLINE }} />
        <Slot song={getSong(match.songBId)} mirrored={mirrored} won={bWon} lost={Boolean(match.winnerId) && !bWon} />
      </div>
    );
  };

  const Column = ({ ids, mirrored, style }: { ids: number[]; mirrored: boolean; style?: React.CSSProperties }) => (
    <div data-giorgia-bracket-column style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', height: '100%', flexShrink: 0, ...style }}>
      {ids.map((id) => (
        <MatchCard key={id} match={safeMatches[id - 1]} mirrored={mirrored} />
      ))}
    </div>
  );

  const finalMatch = safeMatches[14];
  const champion = getSong(finalMatch.winnerId);
  const drawnSongs = normalizedDrawCommand ? normalizedDrawCommand.songIds.map((songId) => getSong(songId)).filter((song): song is SongCatalogItem => Boolean(song)) : [];
  const drawProgress = normalizedDrawCommand && drawStartedAtMs > 0 ? Math.min(1, Math.max(0, (nowMs - drawStartedAtMs) / (normalizedDrawCommand.durationSeconds * 1000))) : 0;
  const featuredDrawSong = drawnSongs.length > 0 ? drawnSongs[Math.floor(nowMs / 180) % drawnSongs.length] : null;
  const activeVotingMatch = typeof activeVotingMatchId === 'number' ? safeMatches[activeVotingMatchId - 1] : null;
  const activeVoters = voters.filter((voter) => voter && typeof voter.id === 'string' && typeof voter.name === 'string' && voter.name.trim());
  const voterRotationOffset = activeVotingMatch && activeVoters.length > 0 ? (activeVotingMatch.id - (isQuarterfinalStart ? 9 : 1)) % activeVoters.length : 0;
  const rotatedActiveVoters = voterRotationOffset > 0 ? [...activeVoters.slice(voterRotationOffset), ...activeVoters.slice(0, voterRotationOffset)] : activeVoters;
  const votingResultVisible =
    activeVotingMatch !== null &&
    activeVotingMatch.winnerId !== null &&
    activeVotingMatch.winnerId === votingWinnerId &&
    typeof votingResultStartedAt === 'number' &&
    votingNowMs < votingResultStartedAt + VOTING_RESULT_MS;
  const votingWinner = votingResultVisible ? getSong(votingWinnerId) : undefined;
  const showVoting =
    activeVotingMatch !== null &&
    activeVotingMatch.songAId !== null &&
    activeVotingMatch.songBId !== null &&
    rotatedActiveVoters.length > 0 &&
    (activeVotingMatch.winnerId === null || votingResultVisible);
  // The semifinals tuck in under the quarterfinals, on rows of their own, so the round of 16 fits between the
  // Giorgia safe edges and the two semifinals keep a gap at the centre.
  const innerOverlap = isQuarterfinalStart ? 30 : -(CARD_WIDTH_PX + 12);

  const modal: React.CSSProperties = {
    ...plate,
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 40,
    padding: `${GIORGIA.platePadding}px ${GIORGIA.platePadding}px ${GIORGIA.platePadding}px ${GIORGIA.platePadding + GIORGIA.ruleWidth + 18}px`
  };
  const panelRule = <div aria-hidden='true' data-giorgia-rule style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${GIORGIA.ruleWidth}px`, background: GIORGIA.signal }} />;

  return (
    <div
      className='modoitaliano-giorgia-bracket'
      aria-label='Modo Italiano Giorgia bracket'
      style={{ position: 'absolute', inset: 0, zIndex: 900, pointerEvents: 'none', fontFamily: GIORGIA.display, color: '#ffffff' }}
    >
      {/* One navy veil over the picture, so the bracket's type reads on any background. */}
      <div aria-hidden='true' style={{ position: 'absolute', inset: 0, background: 'rgba(7,13,43,0.86)' }} />

      <div
        data-giorgia-bracket-stage
        style={{ position: 'absolute', left: `${GIORGIA.safeX}px`, right: `${GIORGIA.safeX}px`, top: `${STAGE_TOP_PX}px`, bottom: `${STAGE_BOTTOM_PX}px`, display: 'flex', justifyContent: 'space-between' }}
      >
        <div style={{ display: 'flex', width: '50%' }}>
          {!isQuarterfinalStart ? <Column ids={[1, 2, 3, 4]} mirrored={false} /> : null}
          <Column ids={[9, 10]} mirrored={false} style={{ marginLeft: isQuarterfinalStart ? 0 : '30px' }} />
          <Column ids={[13]} mirrored={false} style={{ marginLeft: `${innerOverlap}px` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '50%' }}>
          <Column ids={[14]} mirrored style={{ marginRight: `${innerOverlap}px` }} />
          <Column ids={[11, 12]} mirrored style={{ marginRight: isQuarterfinalStart ? 0 : '30px' }} />
          {!isQuarterfinalStart ? <Column ids={[5, 6, 7, 8]} mirrored /> : null}
        </div>
      </div>

      {/* The final and the champion, centred in the bottom row. */}
      <div
        data-giorgia-bracket-final
        style={{ position: 'absolute', left: '50%', bottom: `${GIORGIA.safeBottom}px`, transform: 'translateX(-50%)', display: 'flex', alignItems: 'flex-end', gap: '40px' }}
      >
        <div style={{ position: 'relative', paddingLeft: `${GIORGIA.ruleWidth + 18}px` }}>
          {panelRule}
          <div style={{ ...eyebrow(GIORGIA.signal), marginBottom: '14px' }}>Gran Final</div>
          <MatchCard match={finalMatch} mirrored={false} />
        </div>
        <div data-giorgia-bracket-champion={champion ? 'crowned' : 'open'} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ ...eyebrow(champion ? GIORGIA.signal : 'rgba(255,255,255,0.4)'), marginBottom: '14px' }}>CAMPEÓN</div>
          {champion?.coverUrl ? (
            <img src={champion.coverUrl} alt='' style={{ width: `${SLOT_HEIGHT_PX * 2 + 1}px`, height: `${SLOT_HEIGHT_PX * 2 + 1}px`, objectFit: 'cover', display: 'block', outline: `${GIORGIA.ruleWidth / 2}px solid ${GIORGIA.signal}` }} />
          ) : (
            <div style={{ width: `${SLOT_HEIGHT_PX * 2 + 1}px`, height: `${SLOT_HEIGHT_PX * 2 + 1}px`, border: champion ? `${GIORGIA.ruleWidth / 2}px solid ${GIORGIA.signal}` : '2px solid rgba(255,255,255,0.3)', boxSizing: 'border-box' }} />
          )}
        </div>
      </div>

      {isDrawing ? (
        <div data-giorgia-bracket-draw style={{ ...modal, width: '760px' }}>
          {panelRule}
          <div style={{ ...giorgiaLabelStyle, color: GIORGIA.signal, marginBottom: '24px' }}>SORTEO</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            {featuredDrawSong?.coverUrl ? <img data-giorgia-bracket-draw-cover src={featuredDrawSong.coverUrl} alt='' style={{ width: '180px', height: '180px', objectFit: 'cover', display: 'block' }} /> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
              <span style={{ ...eyebrow('rgba(255,255,255,0.62)'), fontSize: '26px' }}>{featuredDrawSong?.artist ?? 'Seleccionando'}</span>
              <span style={{ fontFamily: GIORGIA.display, fontWeight: 800, fontSize: '64px', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>{featuredDrawSong?.title ?? 'Canciones'}</span>
            </div>
          </div>
          <div style={{ marginTop: '28px', height: '6px', background: 'rgba(255,255,255,0.14)' }}>
            <div data-giorgia-bracket-draw-progress style={{ height: '100%', width: `${drawProgress * 100}%`, background: GIORGIA.signal }} />
          </div>
        </div>
      ) : null}

      {showVoting && activeVotingMatch ? (
        <div data-giorgia-bracket-voting style={{ ...modal, minWidth: '1100px' }}>
          {panelRule}
          {votingResultVisible ? (
            <div data-giorgia-bracket-voting-winner style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
              {votingWinner?.coverUrl ? <img src={votingWinner.coverUrl} alt='' style={{ width: `${VOTE_COVER_PX}px`, height: `${VOTE_COVER_PX}px`, objectFit: 'cover', display: 'block' }} /> : null}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ ...giorgiaLabelStyle, color: GIORGIA.signal }}>WINNER</span>
                <strong style={{ fontFamily: GIORGIA.display, fontWeight: 800, fontSize: '56px', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.03em' }}>
                  {votingWinner ? `${votingWinner.artist} - ${votingWinner.title}` : 'Winner'}
                </strong>
              </div>
            </div>
          ) : (
            <>
              <div style={{ ...giorgiaLabelStyle, color: GIORGIA.signal, marginBottom: '28px' }}>VOTACIÓN</div>
              <div data-giorgia-bracket-voting-grid style={{ display: 'grid', gap: '36px', gridTemplateColumns: `repeat(${rotatedActiveVoters.length}, minmax(0, 1fr))` }}>
                {rotatedActiveVoters.map((voter) => {
                  const vote = matchVotes[String(activeVotingMatch.id)]?.[voter.id] ?? null;
                  const votedSong = getSong(vote);
                  return (
                    <div key={voter.id} data-giorgia-bracket-voter style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div data-giorgia-bracket-vote={votedSong ? 'revealed' : 'open'} style={{ width: `${VOTE_COVER_PX}px`, height: `${VOTE_COVER_PX}px`, border: votedSong ? 'none' : '2px solid rgba(255,255,255,0.3)', boxSizing: 'border-box' }}>
                        {votedSong?.coverUrl ? <img src={votedSong.coverUrl} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
                      </div>
                      <div data-giorgia-bracket-voter-name style={{ ...giorgiaLabelStyle, color: '#ffffff' }}>{voter.name}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};
